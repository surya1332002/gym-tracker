import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const bundle = await build({ stdin: { contents: "export * from './src/features/workout/programmes';export * from './src/features/workout/WorkoutDraft';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'no-live-client', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url)
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { programmeAttempt, programmePayload, createProgrammeRepository, workoutDraftDirty } = module.exports
const id = '11111111-1111-4111-8111-111111111111', saveId = '22222222-2222-4222-8222-222222222222', exerciseId = '33333333-3333-4333-8333-333333333333'
const draft = () => ({ name: '  Synthetic programme  ', split: 'Custom', muscles: [], days: Array.from({ length: 9 }, (_, i) => ({ name: ` Day ${i + 1} `, exercises: [{ exerciseId, name: 'Synthetic movement', sets: 3, min: 8, max: 12 }] })) })
function fixture() {
  let user = 'a', error = null, response = { id, user_id: 'a', revision: 1 }, afterRpc
  const calls = [], query = { then(resolve, reject) { return Promise.resolve({ data: [response], error }).then(resolve, reject) } }
  for (const method of ['select', 'eq', 'order', 'not', 'in']) query[method] = (...args) => { calls.push([method, ...args]); return query }
  const client = { auth: { getSession: async () => ({ data: { session: user ? { user: { id: user } } : null }, error: null }) }, from: table => { calls.push(['from', table]); return query }, rpc: async (name, args) => { calls.push(['rpc', name, args]); afterRpc?.(); return { data: response, error } } }
  return { client, calls, setUser: value => { user = value }, setError: value => { error = value }, setResponse: value => { response = value }, afterRpc: callback => { afterRpc = callback } }
}
test('ordered programme payload supports more than seven days and preserves nullable starting weights', () => {
  const original = draft(), payload = programmePayload(original)
  assert.equal(payload.name, 'Synthetic programme')
  assert.equal(payload.days.length, 9)
  assert.equal(payload.days[8].name, 'Day 9')
  assert.deepEqual(payload.days[0].exercises[0], { exercise_id: exerciseId, target_sets: 3, target_weight_kg: null, target_reps_min: 8, target_reps_max: 12 })
  assert.equal(original.name, '  Synthetic programme  ')
  payload.days[0].exercises[0].target_sets = 4
  assert.equal(original.days[0].exercises[0].sets, 3)
})
test('payload rejects shared IDs, invalid plans, unnamed days and incomplete split configuration', () => {
  const value = draft()
  assert.throws(() => programmePayload({ ...value, name: '' }), /name/)
  assert.throws(() => programmePayload({ ...value, split: 'Two muscles', muscles: ['Chest'] }), /muscle/)
  assert.deepEqual(programmePayload({ ...value, days: [] }).days, [])
  value.days[0].name = ''; assert.throws(() => programmePayload(value), /name/)
  value.days[0].name = 'Day'; value.days[0].exercises[0].exerciseId = 'starter-bench-press'
  assert.throws(() => programmePayload(value), /personal exercise identity/)
  value.days[0].exercises[0].exerciseId = exerciseId; value.days[0].exercises[0].sets = 3.5
  assert.throws(() => programmePayload(value), /sets/)
})
test('deployment gate blocks all new reads/writes before any client call', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client, false)
  for (const action of [() => repo.selectCatalogue('a', 'starter-bench-press'), () => repo.listMemberships('a'), () => repo.listProgrammes('a'), () => repo.listProgrammeDays('a', id, 1), () => repo.saveProgramme('a', id, 0, saveId, draft())]) await assert.rejects(action, /Apply the catalogue/)
  assert.deepEqual(f.calls, [])
})
test('save retries retain caller identities and payload; failures never mutate draft', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client, true), value = draft(), original = JSON.stringify(value)
  f.setError(new Error('ambiguous network outcome'))
  await assert.rejects(() => repo.saveProgramme('a', id, 0, saveId, value), /network/)
  f.setError(null); await repo.saveProgramme('a', id, 0, saveId, value)
  assert.deepEqual(f.calls[0], f.calls[1])
  assert.equal(JSON.stringify(value), original)
  assert.equal(f.calls[0][2].p_expected_revision, 0)
})
test('account mismatch and account switches suppress save confirmation', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client, true)
  f.setUser('b'); await assert.rejects(() => repo.saveProgramme('a', id, 0, saveId, draft()), /matching/)
  assert.deepEqual(f.calls, [])
  f.setUser('a'); f.afterRpc(() => f.setUser('b'))
  await assert.rejects(() => repo.saveProgramme('a', id, 0, saveId, draft()), /matching/)
})
test('foreign or mismatched save receipts cannot become a saved state', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client, true)
  f.setResponse({ id, user_id: 'b', revision: 1 }); await assert.rejects(() => repo.saveProgramme('a', id, 0, saveId, draft()), /another account/)
  f.setResponse({ id, user_id: 'a', revision: 2 }); await assert.rejects(() => repo.saveProgramme('a', id, 0, saveId, draft()), /not confirmed/)
  f.setError(new Error('revision conflict')); await assert.rejects(() => repo.saveProgramme('a', id, 1, saveId, draft()), /conflict/)
})
test('catalogue Added confirmation requires the exact owned active mapping returned by RPC', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client, true), mapping = { id: exerciseId, user_id: 'a', catalogue_id: 'starter-bench-press', is_archived: false }
  f.setResponse(mapping); assert.deepEqual(await repo.selectCatalogue('a', 'starter-bench-press'), mapping)
  assert.equal(f.calls[0][1], 'arc_fit_select_catalogue')
  f.setResponse({ ...mapping, catalogue_id: 'starter-pull-up' }); await assert.rejects(() => repo.selectCatalogue('a', 'starter-bench-press'), /not confirmed/)
  f.setResponse({ ...mapping, is_archived: true }); await assert.rejects(() => repo.selectCatalogue('a', 'starter-bench-press'), /not confirmed/)
})
test('future membership/programme reads are owner-filtered and reject foreign returned rows', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client, true)
  await repo.listMemberships('a'); await repo.listProgrammes('a')
  assert.equal(f.calls.filter(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'a').length, 2)
  f.setResponse({ id, user_id: 'b' }); await assert.rejects(() => repo.listMemberships('a'), /another account/)
})

test('programme day queries keep programmes and retained revisions separate', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client, true), row = { id: exerciseId, user_id: 'a', programme_id: id, programme_revision: 2, name: 'Synthetic day', sequence_number: 9 }
  f.setResponse(row); assert.deepEqual(await repo.listProgrammeDays('a', id, 2), [row])
  assert.ok(f.calls.some(call => call[0] === 'eq' && call[1] === 'programme_id' && call[2] === id))
  assert.ok(f.calls.some(call => call[0] === 'eq' && call[1] === 'programme_revision' && call[2] === 2))
  f.setResponse({ ...row, programme_revision: 1 }); await assert.rejects(() => repo.listProgrammeDays('a', id, 2), /requested revision/)
})

 test('default repository attempts live contract and missing schema gives actionable migration error', async () => {
  const f = fixture(), repo = createProgrammeRepository(f.client)
  f.setError({ code: 'PGRST202', message: 'function missing' })
  await assert.rejects(() => repo.saveProgramme('a', id, 0, saveId, draft()), /Apply the catalogue\/programme migration/)
  assert.equal(f.calls[0][1], 'arc_fit_save_programme')
 })
 test('programme load fetches only requested revision, preserves ordering and owned personal targets', async () => {
  const calls = []
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'a' } } }, error: null }) }, from(table) {
    const filters = []
    const q = { then(resolve, reject) {
      const data = table === 'routine_days' ? [{ id: saveId, user_id: 'a', programme_id: id, programme_revision: 2, name: 'Day nine', sequence_number: 9 }] : table === 'routine_exercises' ? [{ id, user_id: 'a', routine_day_id: saveId, exercise_id: exerciseId, position: 1, target_sets: 4, target_reps_min: 6, target_reps_max: 10 }] : [{ id: exerciseId, user_id: 'a', name: 'Owned exercise' }]
      calls.push([table, filters]); return Promise.resolve({data, error: null}).then(resolve, reject)
    } }
    for (const method of ['select','eq','order','in']) q[method] = (...args) => { filters.push([method,...args]); return q }
    return q
  }, rpc() { throw new Error('no writes during load') } }
  const loaded = await createProgrammeRepository(client).loadProgramme('a', { id, user_id: 'a', revision: 2, name: 'Saved', split: 'Custom', muscles: [] })
  assert.equal(loaded.days[0].exercises[0].name, 'Owned exercise')
  assert.equal(loaded.days[0].exercises[0].sets, 4)
  assert.ok(calls[0][1].some(value => value[1] === 'programme_revision' && value[2] === 2))
  assert.ok(calls[1][1].some(value => value[1] === 'routine_day_id' && value[2] === saveId))
 })

test('pending retry keeps frozen save identity and version when editable draft changes', () => {
 const editable = draft(), pending = programmeAttempt(editable, null, saveId)
 editable.days[0].exercises[0].sets = 7
 editable.name = 'Newer unsaved title'
 const retry = programmeAttempt(editable, pending, id)
 assert.equal(retry.saveId, saveId)
 assert.equal(retry.draft.days[0].exercises[0].sets, 3)
 assert.notEqual(retry.draft.name, editable.name)
 assert.equal(editable.days[0].exercises[0].sets, 7)
})

test('confirmed unchanged programmes are clean; staged, pending and invalid drafts are dirty', () => {
 const value = draft(); value.name = value.name.trim(); value.days.forEach(day => {day.name = day.name.trim()})
 const configuration = { name: value.name, split: value.split, count: value.days.length, muscles: ['', '', ''] }
 const state = { id, revision: 1, savedPayload: JSON.stringify(programmePayload(value)), pending: null }
 assert.equal(workoutDraftDirty(value, configuration, state), false)
 assert.equal(workoutDraftDirty(value, {...configuration, count: 10}, state), true)
 assert.equal(workoutDraftDirty(value, configuration, {...state, pending: programmeAttempt(value, null, saveId)}), true)
 assert.equal(workoutDraftDirty({...value, name: ''}, configuration, state), true)
})
test('invalid newer draft does not obstruct retry of an already validated pending snapshot', async () => {
 const value = draft(), pending = programmeAttempt(value, null, saveId)
 value.name = ''; value.days[0].exercises[0].sets = 0
 const attempt = programmeAttempt(value, pending, id)
 const f = fixture(); await createProgrammeRepository(f.client).saveProgramme('a', id, 0, attempt.saveId, attempt.draft)
 assert.equal(f.calls[0][2].p_save_id, saveId)
 assert.equal(f.calls[0][2].p_payload.days[0].exercises[0].target_sets, 3)
})

test('empty programmes and blank targets save explicitly without invented values; invalid weights fail before writes', async () => {
 const f=fixture(),repo=createProgrammeRepository(f.client),value=draft()
 value.days=[];await repo.saveProgramme('a',id,0,saveId,value);assert.deepEqual(f.calls[0][2].p_payload.days,[])
 value.days=[{name:'Blank day',exercises:[{exerciseId,name:'Press',sets:null,min:null,max:null,startingWeightLb:''}]}]
 await repo.saveProgramme('a',id,0,saveId,value)
 assert.deepEqual(f.calls[1][2].p_payload.days[0].exercises[0],{exercise_id:exerciseId,target_sets:null,target_weight_kg:null,target_reps_min:null,target_reps_max:null})
 value.days[0].exercises[0].startingWeightLb='70';assert.equal(programmePayload(value).days[0].exercises[0].target_weight_kg,70*0.45359237)
 const count=f.calls.length
 for(const weight of ['-1','NaN','Infinity']) {value.days[0].exercises[0].startingWeightLb=weight;await assert.rejects(()=>repo.saveProgramme('a',id,0,saveId,value),/Starting weight/)}
 assert.equal(f.calls.length,count)
})

test('optional target save/load round-trip preserves blanks and canonical starting weight', async () => {
 let stored, revision=0
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'a'}}},error:null})},rpc:async(name,args)=>{stored=structuredClone(args.p_payload);revision++;return {data:{id,user_id:'a',revision},error:null}},from(table){const q={select(){return q},eq(){return q},order(){return q},in(){return q},then(resolve,reject){const data=table==='routine_days'?stored.days.map((day,i)=>({id:saveId,user_id:'a',programme_id:id,programme_revision:revision,name:day.name,sequence_number:i+1})):table==='routine_exercises'?stored.days[0].exercises.map(e=>({...e,id,user_id:'a',routine_day_id:saveId,position:1})):[{id:exerciseId,user_id:'a',name:'Press'}];return Promise.resolve({data,error:null}).then(resolve,reject)}};return q}}
 const repo=createProgrammeRepository(client),saved={id,user_id:'a',revision:1,name:'Empty',split:'Custom',muscles:[]}
 await repo.saveProgramme('a',id,0,saveId,{name:'Empty',split:'Custom',muscles:[],days:[]})
 assert.deepEqual((await repo.loadProgramme('a',saved)).days,[])
 for(const weight of ['', '70', '70.123456', '0']) {
 const value={name:'Empty',split:'Custom',muscles:[],days:[{name:'Day',exercises:[{exerciseId,name:'Press',sets:null,min:null,max:null,startingWeightLb:weight}]}]}
 await repo.saveProgramme('a',id,revision,saveId,value)
 const loaded=await repo.loadProgramme('a',{...saved,revision});const target=loaded.days[0].exercises[0]
 assert.equal(target.sets,null);assert.equal(target.min,null);assert.equal(target.max,null);assert.equal(target.startingWeightLb,weight)
 assert.deepEqual(programmePayload(loaded),stored)
 }
})
