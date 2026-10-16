import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const built = await build({ stdin: { contents: "export * from './src/features/workout/performanceReferences';", resolveDir: process.cwd(), loader: 'ts' }, bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'fixture',setup(b){b.onResolve({filter:/(?:^|\/)supabase$/},()=>({path:'fixture-client',external:true}))}}] })
const module={exports:{}},require=createRequire(import.meta.url)
new Function('require','module','exports',built.outputFiles[0].text)(name=>name==='fixture-client'?{supabase:{}}:require(name),module,module.exports)
const { createReferenceRepository, chooseReference, prefillNewSession }=module.exports
const manifest={records:[{source_key:'synthetic:day:exercise',movementKey:'fixture',catalogueId:null,name:'Synthetic exercise',equipment:'cable',day:'Synthetic day',order:0,performance_date:null,recorded_sets:[{number:1,weight_lb:70,reps:10,raw_weight:'70',raw_reps:'10'},{number:2,weight_lb:70,reps:9,raw_weight:'70',raw_reps:'9'},{number:3,weight_lb:70,reps:5,raw_weight:'70',raw_reps:'5'}],weight_unit:'lb',machine_settings:'Synthetic bench setting',per_side_qualifiers:'',original_notes:'Synthetic fixture',source_fields:{Exercise:'Synthetic exercise'}}]}
function input(record=manifest.records[0]) { const {movementKey,catalogueId,name,equipment,day,order,...rest}=record;return {...rest,exercise_id:'exercise',routine_day_id:'day'} }
function fixture() {
  let user='own',acceptThenFail=false; const stored=[],calls=[]
  const client={auth:{getSession:async()=>({data:{session:{user:{id:user}}},error:null})},from(table){let filters=[],values;const q={select(){return q},eq(key,value){filters.push(row=>row[key]===value);return q},in(key,value){filters.push(row=>value.includes(row[key]));return q},upsert(rows,options){values=rows;calls.push([table,options]);return q},then(resolve,reject){return Promise.resolve().then(()=>{
    if(values) for(const row of values){const existing=stored.find(item=>item.user_id===row.user_id&&item.source_key===row.source_key);if(existing)Object.assign(existing,row);else stored.push(structuredClone(row))}
    if(values&&acceptThenFail){acceptThenFail=false;throw new Error('ambiguous network failure')}
    return {data:structuredClone(values??stored.filter(row=>filters.every(filter=>filter(row)))),error:null}
  }).then(resolve,reject)}};return q}}
  return {stored,calls,repo:createReferenceRepository(client),setUser:value=>{user=value},failOnce:()=>{acceptThenFail=true}}
}
test('retry after accepted network failure keeps references idempotent and never writes workout history',async()=>{
  const f=fixture();f.failOnce();await assert.rejects(()=>f.repo.import('own',[input()]),/network/)
  const id=f.stored[0].id;await f.repo.import('own',[input()]);await f.repo.import('own',[input()]);assert.equal(f.stored.length,1);assert.equal(f.stored[0].id,id)
  assert.ok(f.calls.every(([table])=>table==='exercise_performance_references'));assert.equal(f.calls[0][1].onConflict,'user_id,source_key')
})
test('references reject invented dates, altered raw values, duplicate sources and wrong accounts before writes',async()=>{
  const f=fixture();await assert.rejects(()=>f.repo.import('own',[{...input(),performance_date:'2026-10-10'}]),/undated/)
  const modified=input();modified.recorded_sets=structuredClone(modified.recorded_sets);modified.recorded_sets[0].weight_lb=71;await assert.rejects(()=>f.repo.import('own',[modified]),/original/)
  await assert.rejects(()=>f.repo.import('own',[input(),input()]),/Duplicate source/)
  f.setUser('other');await assert.rejects(()=>f.repo.import('own',[input()]),/matching/);assert.equal(f.calls.length,0)
})
test('new-session prefill preserves blanks and qualifiers and never completes or changes existing performed sets',()=>{
  const row={...input(),id:'reference',user_id:'own'}
  const session={id:'new',dayId:'day',exercises:[{exerciseId:'exercise',sets:[{number:1,lb:'',reps:'',completed:false,completedAt:null},{number:2,lb:'80',reps:'11',completed:false,completedAt:null},{number:3,lb:'70',reps:'5',completed:true,completedAt:'actual'}]}]}
  const updated=prefillNewSession(session,[row]);assert.equal(updated.exercises[0].sets[0].lb,'70');assert.equal(updated.exercises[0].sets[0].reps,'10');assert.equal(updated.exercises[0].sets[0].completed,false);assert.equal(session.exercises[0].sets[0].lb,'')
  assert.deepEqual(updated.exercises[0].sets[1],session.exercises[0].sets[1]);assert.deepEqual(updated.exercises[0].sets[2],session.exercises[0].sets[2])
  const ambiguous={...row,per_side_qualifiers:'17.5 each'};assert.equal(prefillNewSession(session,[ambiguous]).exercises[0].sets[0].lb,'');assert.equal(prefillNewSession(session,[ambiguous]).exercises[0].sets[0].reps,'10')
})
test('explicit starting weight keeps priority while previous repetitions remain suggestions',()=>{
  const row={...input(),id:'reference',user_id:'own'}
  const session={id:'new',dayId:'day',exercises:[{exerciseId:'exercise',startingWeightLb:'80',sets:[{number:1,lb:'80',reps:'',completed:false,completedAt:null},{number:2,lb:'85',reps:'',completed:false,completedAt:null}]}]}
  const updated=prefillNewSession(session,[row]);assert.equal(updated.exercises[0].sets[0].lb,'80');assert.equal(updated.exercises[0].sets[0].reps,'10');assert.equal(updated.exercises[0].sets[0].completed,false)
  assert.deepEqual(updated.exercises[0].sets[1],session.exercises[0].sets[1])
})

test('known actual history wins over undated references; ambiguous undated sources never invent chronology',()=>{
  const row={...input(),id:'reference',user_id:'own'},dated={...row,id:'history',routine_day_id:'another-day',performance_date:'2026-10-09'}
  assert.equal(chooseReference([row,dated],'exercise','day').id,'history');assert.equal(chooseReference([row,{...row,id:'second'}],'exercise','day'),null)
  assert.equal(chooseReference([row],'unknown','day'),null)
})
test('previous-performance history includes only completed dated sets, without writes',async()=>{
  const calls=[]
  const tables={exercise_performance_references:[],workouts:[{id:'done',user_id:'own',routine_day_id:'day',workout_date:'2026-10-09',completed_at:'actual',status:'completed'},{id:'unfinished',user_id:'own',status:'in_progress',workout_date:'2026-10-10',routine_day_id:'day'}],workout_exercises:[{id:'partial',user_id:'own',workout_id:'unfinished',exercise_id:'exercise',machine_preset_snapshot:{},notes:''},{id:'performed',user_id:'own',workout_id:'done',exercise_id:'exercise',machine_preset_snapshot:{},notes:''}],workout_sets:[{id:'partial-set',user_id:'own',workout_exercise_id:'partial',set_number:1,weight_kg:22.6796185,input_weight:50,input_unit:'lb',reps:12,is_completed:true},{id:'actual',user_id:'own',workout_exercise_id:'performed',set_number:1,weight_kg:31.7514659,reps:10,is_completed:true},{id:'planned',user_id:'own',workout_exercise_id:'performed',set_number:2,weight_kg:null,reps:null,is_completed:false}]}
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'own'}}},error:null})},from(table){calls.push(table);let predicates=[];const query={select(){return query},order(){return query},limit(){return query},eq(key,value){predicates.push(row=>row[key]===value);return query},in(key,values){predicates.push(row=>values.includes(row[key]));return query},then(resolve,reject){return Promise.resolve({data:tables[table].filter(row=>predicates.every(predicate=>predicate(row))),error:null}).then(resolve,reject)}};return query}}
  const partial=await createReferenceRepository(client).previous('own',['exercise']);assert.equal(partial.length,2);assert.equal(partial.find(row=>row.performance_date==='2026-10-10').recorded_sets[0].weight_lb,50);calls.length=0;const previous=await createReferenceRepository(client).previous('own',['exercise'],'unfinished');assert.equal(previous.length,1);assert.equal(previous[0].recorded_sets.length,1);assert.equal(previous[0].recorded_sets[0].weight_lb,70);assert.equal(previous[0].recorded_sets[0].reps,10);assert.equal(previous[0].performance_date,'2026-10-09');assert.equal(calls.length,4)
})
test('migration is one-table only, grants no anonymous access and checks ownership on both writes',()=>{
  const sql=readFileSync('docs/migrations/20261010_02_exercise_performance_references.sql','utf8')
  assert.equal((sql.match(/create table /g)??[]).length,1);assert.ok(sql.includes('enable row level security'));assert.ok(sql.includes('unique (user_id, source_key)'))
  assert.ok(sql.includes('revoke all'));assert.equal((sql.match(/with check/g)??[]).length,2);assert.equal((sql.match(/e.user_id =/g)??[]).length,2);assert.equal((sql.match(/d.user_id =/g)??[]).length,2)
  assert.ok(!/security definer|alter table public\.(workouts|exercises|routine_days)\b|grant .* to anon|truncate|drop table/i.test(sql))
})
