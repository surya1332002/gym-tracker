import { supabase } from '../../lib/supabase'
export type DeletedWorkout = { id: string; user_id: string; routine_name_snapshot: string; workout_date: string; deleted_at: string; status: string; completed_at: string | null }
export const recoveryPeriodMs = 30 * 24 * 60 * 60 * 1000
export function recoverableWorkouts(rows: DeletedWorkout[], now = Date.now()) {
  return rows.filter(row => row.status === 'completed' && row.completed_at && Number.isFinite(Date.parse(row.deleted_at)) && Date.parse(row.deleted_at) >= now - recoveryPeriodMs && Date.parse(row.deleted_at) <= now).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
}
export function createDeletedWorkoutRepository(client: Pick<typeof supabase, 'auth' | 'from'>) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw error; if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  return { async list(userId: string): Promise<DeletedWorkout[]> {
    await account(userId); const result: DeletedWorkout[] = []
    for (let start = 0; ; start += 250) { const { data, error } = await client.from('workouts').select('id,user_id,routine_name_snapshot,workout_date,deleted_at,status,completed_at').eq('user_id', userId).eq('status', 'completed').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).range(start, start + 249); if (error) throw error; if (data?.some(row => row.user_id !== userId)) throw new Error('Deleted workout belongs to another account.'); result.push(...(data ?? [])); if (!data || data.length < 250) break }
    await account(userId); return recoverableWorkouts(result)
  } }
}
export const deletedWorkoutRepository = createDeletedWorkoutRepository(supabase)
