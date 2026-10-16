import type {SupabaseClient} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
export type DeletionRequest={user_id:string;requested_at:string;purge_after:string}
export function createAccountRecoveryRepository(client:SupabaseClient=supabase){
 async function account(userId:string){const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session?.user.id!==userId)throw new Error('A matching signed-in account is required.')}
 function owned(row:DeletionRequest,userId:string){if(row.user_id!==userId||!Number.isFinite(Date.parse(row.requested_at))||!Number.isFinite(Date.parse(row.purge_after)))throw new Error('Account request could not be verified.');return row}
 return {
 async status(userId:string){await account(userId);const {data,error}=await client.from('account_deletion_requests').select('user_id,requested_at,purge_after').eq('user_id',userId).maybeSingle();if(error)throw error;await account(userId);return data?owned(data,userId):null},
 async request(userId:string,backendReady:boolean){if(!backendReady)throw new Error('Account deletion is unavailable until the reliable deletion backend is enabled.');await account(userId);const {data,error}=await client.rpc('arc_fit_account_recovery',{p_action:'request'});if(error)throw error;await account(userId);return owned(data as DeletionRequest,userId)},
 async recover(userId:string){await account(userId);const {data,error}=await client.rpc('arc_fit_account_recovery',{p_action:'recover'});if(error)throw error;await account(userId);if(data?.recovered!==true)throw new Error('Account recovery was not confirmed.')}
 }
}
export const accountRecoveryRepository=createAccountRecoveryRepository()
