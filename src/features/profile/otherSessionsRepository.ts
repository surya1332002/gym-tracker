import type {SupabaseClient} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
export async function revokeOtherSessions(userId:string,confirmed:boolean,client:SupabaseClient=supabase){
 if(!confirmed)throw new Error('Confirm that you want to sign out other devices.')
 const verified=await client.auth.getUser();if(verified.error)throw verified.error;if(verified.data.user?.id!==userId)throw new Error('Verify your signed-in account before revoking other sessions.')
 const before=await client.auth.getSession();if(before.error)throw before.error;if(before.data.session?.user.id!==userId)throw new Error('Your signed-in account changed.')
 const {error}=await client.auth.signOut({scope:'others'});if(error)throw error
 const after=await client.auth.getSession();if(after.error)throw after.error;if(after.data.session?.user.id!==userId)throw new Error('Other-session revocation completed, but this device session needs to be restored.')
}
