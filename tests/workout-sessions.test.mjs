import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const bundle = await build({ entryPoints: ['src/features/workout/sessions.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url)
new Function('require','module','exports',bundle.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name),module,module.exports)
const { makeSession, newSet, createSessionRepository, validateSession, lbToKg, kgToLb } = module.exports
function fixture() {
  const db = { workouts: [], workout_exercises: [], workout_sets: [], machine_presets: [] }, calls = []
  let user = 'own', fail = ''
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: user } } }, error: null }) }, from(table) {
    let operation = 'read', values, filters = [], single = false, sort
    const q = {
      select() { return q }, eq(key,value) { filters.push(row => row[key] === value); return q }, in(key,values) { filters.push(row => values.includes(row[key])); return q }, not(key,op,values) { const ids = values.slice(1,-1).split(','); filters.push(row => !ids.includes(row[key])); return q }, order(key) { sort = key; return q }, single() { single = true; return q }, upsert(v) { operation = 'upsert'; values = v; return q }, update(v) { operation = 'update'; values = v; return q }, delete() { operation = 'delete'; return q },
      then(resolve,reject) { return Promise.resolve().then(() => {
        calls.push([table,operation]); if (fail === table && operation !== 'read') throw new Error('network interruption')
        let result = db[table].filter(row => filters.every(f => f(row)))
        if (operation === 'upsert') { result = values.map(row => { const current = db[table].find(item => item.id === row.id); if (current) Object.assign(current,row); else db[table].push(structuredClone(row)); return row }) }
        if (operation === 'update') result.forEach(row => Object.assign(row,values))
        if (operation === 'delete') db[table] = db[table].filter(row => !result.includes(row))
        if (sort) result.sort((a,b) => a[sort] - b[sort])
        return { data: structuredClone(single ? result[0] : result), error: null }
      }).then(resolve,reject) }
    }; return q
  } }
  return { db,calls,repo:createSessionRepository(client),setUser: value => { user=value },setFailure: value => { fail=value } }
}
const day = { name: 'Synthetic Push', exercises: [{ exerciseId: 'exercise', name:'Press',sets:3,min:8,max:12 }] }
const personal = [{ id:'exercise',user_id:'own',name:'Press',equipment:'machine',notes:'Seat 4. Each side.',instructions:'Controlled movement.' }]
const session = () => makeSession('own','day',day,personal,[],new Date(2026,9,10,20))
test('session snapshots preserve order, plans and settings without inventing performed sets', () => {
  const s=session(); assert.equal(s.date,'2026-10-10'); assert.equal(s.exercises[0].notes,'Seat 4. Each side.'); assert.equal(s.exercises[0].sets.length,3)
  assert.ok(s.exercises[0].sets.every(set => !set.completed && set.lb === '' && set.reps === '' && set.completedAt === null))
  assert.throws(() => validateSession(s,true),/at least one/)
})
test('pounds round-trip through canonical kilogram storage', async () => {
  const f=fixture(),s=session(); s.exercises[0].sets[0].lb='135'; s.exercises[0].sets[0].reps='10'
  await f.repo.save(s); assert.equal(f.db.workout_sets[0].weight_kg,lbToKg(135)); assert.equal(kgToLb(lbToKg(135)),135)
  const loaded=await f.repo.load('own',s.id); assert.equal(loaded.exercises[0].sets[0].lb,'135'); assert.equal(loaded.exercises[0].min,8); assert.equal(loaded.exercises[0].notes,s.exercises[0].notes)
})
test('refresh/resume and retries retain identities without duplicate sessions or sets', async () => {
  const f=fixture(),s=session(); f.setFailure('workout_sets'); await assert.rejects(() => f.repo.save(s),/network/)
  assert.equal(f.db.workouts.length,1); assert.equal(f.db.workouts[0].status,'in_progress')
  f.setFailure(''); await f.repo.save(s); await f.repo.save(s); assert.equal(f.db.workouts.length,1); assert.equal(f.db.workout_sets.length,3)
  const loaded=await f.repo.load('own',s.id); loaded.exercises[0].sets[1].reps='9'; loaded.exercises[0].sets[1].completed=true; loaded.exercises[0].sets[1].completedAt=new Date().toISOString(); await f.repo.save(loaded)
  assert.equal((await f.repo.load('own',s.id)).exercises[0].sets[1].reps,'9')
})
test('add/remove sets affects only the selected active exercise and preserves unrelated records', async () => {
  const f=fixture(),s=session(); f.db.workout_sets.push({ id:'unrelated',user_id:'own',workout_exercise_id:'other',set_number:1 }); await f.repo.save(s)
  s.exercises[0].sets.splice(1,1); s.exercises[0].sets.push(newSet(4)); await f.repo.save(s)
  assert.equal(f.db.workout_sets.length,4); assert.ok(f.db.workout_sets.find(row => row.id === 'unrelated')); assert.deepEqual((await f.repo.load('own',s.id)).exercises[0].sets.map(set => set.number),[1,3,4])
})
test('finishing saves completed sets truthfully, is retryable and cannot reopen history', async () => {
  const f=fixture(),s=session(),set=s.exercises[0].sets[0]; set.reps='8'; set.completed=true; set.completedAt=new Date().toISOString(); s.completedAt=new Date().toISOString()
  f.setFailure('workout_sets'); await assert.rejects(() => f.repo.save(s,true),/network/); assert.equal(f.db.workouts[0].status,'in_progress')
  f.setFailure(''); await f.repo.save(s,true); await f.repo.save(s,true)
  assert.equal(f.db.workouts[0].status,'completed'); assert.equal(f.db.workout_sets.filter(row => row.is_completed).length,1); assert.equal(f.db.workout_sets.filter(row => !row.is_completed).length,2)
  await assert.rejects(() => f.repo.save(s),/already finished/)
})
test('invalid loads/reps and foreign accounts fail before writes', async () => {
  const f=fixture(),s=session(); s.exercises[0].sets[0].lb='-1'; await assert.rejects(() => f.repo.save(s),/Weight/); assert.equal(f.calls.length,0)
  s.exercises[0].sets[0].lb=''; s.exercises[0].sets[0].completed=true; await assert.rejects(() => f.repo.save(s),/repetitions/)
  s.exercises[0].sets[0].completed=false; f.setUser('other'); await assert.rejects(() => f.repo.save(s),/matching/); assert.equal(f.calls.length,0)
})

test('manual ad-hoc sessions have no routine or fabricated set targets and retry safely', async () => {
 const f=fixture(),s=makeSession('own',null,{name:'Random Workout',exercises:[{exerciseId:'exercise',name:'Press',sets:null,min:null,max:null}]},personal)
 assert.equal(s.dayId,null);assert.equal(s.exercises[0].sets.length,0)
 await f.repo.save(s);await f.repo.save(s)
 assert.equal(f.db.workouts.length,1);assert.equal(f.db.workouts[0].routine_day_id,null)
 const loaded=await f.repo.load('own',s.id);assert.equal(loaded.exercises[0].sets.length,0)
 loaded.exercises[0].sets.push(newSet(1));await f.repo.save(loaded)
 assert.equal(f.db.workout_sets.length,1);assert.equal(f.db.workout_sets[0].is_completed,false)
 assert.equal(f.db.workout_sets[0].weight_kg,null);assert.equal(f.db.workout_sets[0].reps,null)
 assert.throws(()=>validateSession(loaded,true),/at least one/)
})

test('blank programme targets create no sets; explicit starting weights are suggestions only', () => {
 const blank={name:'Blank',exercises:[{exerciseId:'exercise',name:'Press',sets:null,min:null,max:null,startingWeightLb:''}]}
 const untouched=makeSession('own','day',blank,personal);assert.equal(untouched.exercises[0].sets.length,0)
 blank.exercises[0].sets=2;blank.exercises[0].startingWeightLb='70'
 const suggested=makeSession('own','day',blank,personal);assert.equal(suggested.exercises[0].sets.length,2)
 assert.ok(suggested.exercises[0].sets.every(set=>set.lb==='70'&&set.reps===''&&!set.completed&&set.completedAt===null))
 assert.throws(()=>validateSession(suggested,true),/at least one/)
})

test('null-count starting weight survives session snapshot save/load without inventing sets', async () => {
 const f=fixture(),value=makeSession('own','day',{name:'Decide sets at gym',exercises:[{exerciseId:'exercise',name:'Press',sets:null,min:null,max:null,startingWeightLb:'70'}]},personal)
 assert.equal(value.exercises[0].startingWeightLb,'70');assert.equal(value.exercises[0].sets.length,0)
 await f.repo.save(value)
 assert.equal(f.db.workout_sets.length,0);assert.equal(f.db.workout_exercises[0].machine_preset_snapshot.startingWeightLb,'70')
 const reopened=await f.repo.load('own',value.id)
 assert.equal(reopened.exercises[0].startingWeightLb,'70');assert.equal(reopened.exercises[0].sets.length,0);assert.equal(reopened.completedAt??null,null);assert.equal(f.db.workouts[0].status,'in_progress')
})
test('configured weight preference snapshots survive save/reopen with an intentionally blank increment',async()=>{const f=fixture(),rows=[{...personal[0],weight_unit:'kg',weight_increment:null,weight_preferences_configured:true}],s=makeSession('own','day',day,rows,[],new Date(2026,9,10,20));assert.equal(s.exercises[0].preferencesConfigured,true);assert.equal(s.exercises[0].increment,null);assert.ok(s.exercises[0].sets.every(set=>set.lb===''&&!set.completed));await f.repo.save(s);const reopened=await f.repo.load('own',s.id);assert.equal(reopened.exercises[0].preferencesConfigured,true);assert.equal(reopened.exercises[0].unit,'kg');assert.equal(reopened.exercises[0].increment,null);assert.ok(reopened.exercises[0].sets.every(set=>set.lb===''&&!set.completed))})
