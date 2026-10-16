import { supabase } from '../../lib/supabase'
import { createSettingsRepository } from '../profile/settings'
export type DashboardExercise = { id: string; user_id: string; name: string; is_favourite: boolean; last_used_at: string | null; is_archived: boolean }
export async function loadDashboardPreferences(userId: string) {
  const preferences = await createSettingsRepository().loadPreferences(userId)
  const { data: before, error: beforeError } = await supabase.auth.getSession(); if (beforeError) throw beforeError; if (before.session?.user.id !== userId) throw new Error('A matching signed-in account is required.')
  const { data, error } = await supabase.from('exercises').select('id,user_id,name,is_favourite,last_used_at,is_archived').eq('user_id', userId).eq('is_archived', false).order('name')
  if (error) throw error
  const { data: after, error: afterError } = await supabase.auth.getSession(); if (afterError) throw afterError; if (after.session?.user.id !== userId || data?.some(row => row.user_id !== userId)) throw new Error('Account changed while loading dashboard preferences.')
  return { weeklyTarget: preferences.weekly_target, exercises: data as DashboardExercise[] ?? [] }
}
