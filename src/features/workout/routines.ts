import { supabase } from '../../lib/supabase'
export type SavedDay = { id: string; user_id: string; name: string; sequence_number: number }
export type SavedRoutineExercise = { id: string; user_id: string; exercise_id: string; routine_day_id: string; position: number; target_sets: number | null; target_weight_kg: number | null; target_reps_min: number | null; target_reps_max: number | null; plan_metadata?: {per_set_reps?: (number|null)[]; group?: import('./planner').PlannedExercise['group']} }
async function account(userId: string, client: Pick<typeof supabase, 'auth' | 'from'> = supabase) {
  const { data: { session }, error } = await client.auth.getSession()
  if (error) throw error
  if (!userId || session?.user.id !== userId) throw new Error('A matching signed-in account is required.')
}
export async function listSavedDays(userId: string): Promise<SavedDay[]> {
  await account(userId)
  let result = await supabase.from('routine_days').select('id,user_id,name,sequence_number').eq('user_id', userId).eq('is_active', true).is('programme_id', null).order('sequence_number')
  if (result.error && ['42703', 'PGRST204'].includes(result.error.code) && result.error.message.includes('programme_id')) {
    // Only the verified pre-migration schema lacks this optional grouping field.
    await account(userId)
    result = await supabase.from('routine_days').select('id,user_id,name,sequence_number').eq('user_id', userId).eq('is_active', true).order('sequence_number')
  }
  const { data, error } = result
  if (error) throw error
  await account(userId)
  if ((data ?? []).some(row => row.user_id !== userId)) throw new Error('Routine response belongs to another account.')
  return data ?? []
}
export async function listDayExercises(userId: string, dayId: string, client: Pick<typeof supabase, 'auth' | 'from'> = supabase): Promise<SavedRoutineExercise[]> {
  await account(userId, client)
  const { data, error } = await client.from('routine_exercises').select('id,user_id,exercise_id,routine_day_id,position,target_sets,target_weight_kg,target_reps_min,target_reps_max,plan_metadata').eq('user_id', userId).eq('routine_day_id', dayId).order('position')
  if (error) throw error
  await account(userId, client)
  if ((data ?? []).some(row => row.user_id !== userId || row.routine_day_id !== dayId)) throw new Error('Routine details do not match this account and day.')
  return data ?? []
}
