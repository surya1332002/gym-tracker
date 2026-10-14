// Server-only scheduled worker. Never import this module into the frontend.
import {createClient} from 'npm:@supabase/supabase-js@2.117.3'
import {handlePurgeRequest,type PurgeBackend} from './purge.ts'
const bucket='arc-fit-private'
function backend():PurgeBackend{
 const url=Deno.env.get('SUPABASE_URL')
 const secretKeys=Deno.env.get('SUPABASE_SECRET_KEYS')
 const key=(secretKeys?JSON.parse(secretKeys).default:undefined)??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)throw new Error('Server administration is not configured.')
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);const prior=init?.signal;const abort=()=>controller.abort();prior?.addEventListener('abort',abort,{once:true});if(prior?.aborted)controller.abort();try{return await fetch(input,{...init,signal:controller.signal})}finally{clearTimeout(timer);prior?.removeEventListener('abort',abort)}}}})
 const objects=client.storage.from(bucket)
 return {
 async prerequisites(){const {data,error}=await client.rpc('arc_fit_account_purge_prerequisites');if(error)throw error;return data===true},
 async due(limit){const {data,error}=await client.from('account_deletion_requests').select('user_id,purge_after').lte('purge_after',new Date().toISOString()).order('purge_after').limit(limit);if(error)throw error;return data??[]},
 async claim(userId,claimId){const {data,error}=await client.rpc('arc_fit_claim_account_purge',{p_user_id:userId,p_claim_id:claimId});if(error)throw error;return data},
 async verify(userId,claimId){const {data,error}=await client.rpc('arc_fit_verify_account_purge_claim',{p_user_id:userId,p_claim_id:claimId});if(error)throw error;return data===true},
 async list(prefix,offset){const {data,error}=await objects.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw error;return(data??[]).map(row=>({name:row.name,id:row.id}))},
 async remove(paths){const {error}=await objects.remove(paths);if(error)throw error},
 async deleteUser(userId){const {data,error}=await client.auth.admin.deleteUser(userId,false);if(error)throw error;if(data.user?.id!==userId)throw new Error('Permanent account deletion was not confirmed.')},
 async purgeTrash(){const {data,error}=await client.rpc('arc_fit_purge_expired_workout_trash');if(error)throw error;if(typeof data!=='number'||data<0)throw new Error('Expired workout cleanup was not confirmed.');return data}
 }
}
Deno.serve(request=>handlePurgeRequest(request,Deno.env.get('ARC_FIT_PURGE_CRON_SECRET'),backend))
