import {createClient} from 'npm:@supabase/supabase-js@2.117.3'

// Disabled until a provider is chosen and configured. No service-role client,
// database writes, background execution or frontend provider credentials.
Deno.serve(async request=>{
 const origin=request.headers.get('origin')??''
 const allowed=(Deno.env.get('ARC_FIT_ALLOWED_ORIGINS')??'').split(',').map(value=>value.trim()).filter(Boolean)
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}
 const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers})
 if(origin&&!allowed.includes(origin))return reply(403,{error:'Origin unavailable'})
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(request.method!=='POST')return reply(405,{error:'POST required'})
 const endpoint=Deno.env.get('AI_CHAT_ENDPOINT'),key=Deno.env.get('AI_API_KEY'),model=Deno.env.get('AI_MODEL')
 if(!endpoint||!key||!model)return reply(503,{error:'Coaching provider is not configured'})
 try{
  if(new URL(endpoint).protocol!=='https:')return reply(503,{error:'Secure provider configuration required'})
  const token=request.headers.get('authorization')
  if(!token?.startsWith('Bearer '))return reply(401,{error:'Authentication required'})
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data:auth,error:authError}=await client.auth.getUser()
  if(authError||!auth.user)return reply(401,{error:'Authentication required'})
  const raw=await request.text()
  if(raw.length>2048)return reply(413,{error:'Request too large'})
  const input=JSON.parse(raw)
  if(typeof input.exerciseId!=='string'||!/^[-a-f0-9]{36}$/i.test(input.exerciseId))return reply(400,{error:'Select one exercise'})
  const {data:exercise,error:exerciseError}=await client.from('exercises').select('id,name').eq('id',input.exerciseId).eq('user_id',auth.user.id).single()
  if(exerciseError||!exercise)return reply(404,{error:'Exercise unavailable'})
  const {data:workouts,error:workoutError}=await client.from('workouts').select('id,workout_date,status,is_incomplete').eq('user_id',auth.user.id).is('deleted_at',null).order('workout_date',{ascending:false}).limit(100)
  if(workoutError)return reply(503,{error:'Workout evidence unavailable'})
  if(!workouts?.length)return reply(422,{error:'No actual workout evidence yet'})
  const {data:instances,error:instanceError}=await client.from('workout_exercises').select('id,workout_id').eq('user_id',auth.user.id).eq('exercise_id',exercise.id).in('workout_id',workouts.map(row=>row.id))
  if(instanceError||!instances?.length)return reply(422,{error:'No recorded performance for this exercise'})
  const {data:sets,error:setError}=await client.from('workout_sets').select('workout_exercise_id,weight_kg,reps,rpe,set_type').eq('user_id',auth.user.id).in('workout_exercise_id',instances.map(row=>row.id)).eq('is_completed',true).limit(500)
  if(setError)return reply(503,{error:'Set evidence unavailable'})
  if(!sets?.length)return reply(422,{error:'No completed sets yet'})
  const evidence={exercise:exercise.name,weightUnit:'kg',scope:'At most the latest 100 retained workouts and 500 actual completed sets for this exercise. Null values are unknown.',sessions:workouts.flatMap(workout=>{const ids=instances.filter(row=>row.workout_id===workout.id).map(row=>row.id);const actual=sets.filter(set=>ids.includes(set.workout_exercise_id)).map(({workout_exercise_id:_,...set})=>set);return actual.length?[{date:workout.workout_date,status:workout.status,incomplete:workout.is_incomplete,sets:actual}]:[]})}
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,max_tokens:800,messages:[{role:'system',content:'Analyze only the supplied completed-set evidence. Explain uncertainty, units and evidence limits. Do not invent missing loads, dates, workouts, personal records, medical claims or recommendations unsupported by the data. Offer optional training suggestions. You cannot change app data.'},{role:'user',content:JSON.stringify(evidence)}]}),signal:AbortSignal.timeout(25000)})
  if(!response.ok)return reply(502,{error:'Coaching provider unavailable'})
  const output=await response.json(),analysis=output?.choices?.[0]?.message?.content
  if(typeof analysis!=='string'||!analysis.trim()||analysis.length>12000)return reply(502,{error:'Provider returned no usable analysis'})
  return reply(200,{analysis})
 }catch{return reply(503,{error:'Coaching unavailable; training data unchanged'})}
})
