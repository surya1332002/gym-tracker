import { supabase } from '../../lib/supabase'
export type WeightTrendPoint = { date: string; kg: number }
export async function loadBodyWeight(userId: string): Promise<WeightTrendPoint[]> {
  const { data: auth, error: authError } = await supabase.auth.getSession()
  if (authError) throw authError
  if (!userId || auth.session?.user.id !== userId) throw new Error('A matching signed-in account is required.')
  const { data, error } = await supabase.from('body_measurements').select('user_id,measured_on,weight_kg').eq('user_id', userId).order('measured_on')
  if (error) throw error
  const { data: after, error: afterError } = await supabase.auth.getSession()
  if (afterError) throw afterError
  if (after.session?.user.id !== userId || data?.some(row => row.user_id !== userId)) throw new Error('Account changed while loading body weight.')
  return (data ?? []).filter(row => row.weight_kg !== null && Number.isFinite(Number(row.weight_kg)) && Number(row.weight_kg) > 0).map(row => ({ date: row.measured_on, kg: Number(row.weight_kg) }))
}
