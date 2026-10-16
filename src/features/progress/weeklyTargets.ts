import { supabase } from '../../lib/supabase'
import { completedSessions, validDate } from './analytics'
import type { WorkoutSession } from '../workout/sessions'
export type WeekTarget = { user_id: string; week_start: string; session_target: number }
export function dateInZone(now: Date, timezone: string) { const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now); return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}` }
export function weekMonday(date: string) { if (!validDate(date)) throw new Error('A valid date is required.'); const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7); return value.toISOString().slice(0, 10) }
export function weekSummary(sessions: WorkoutSession[], targets: WeekTarget[], week: string, current: string, normalTarget: number) {
  const actual = completedSessions(sessions).filter(s => weekMonday(s.date) === week).length, recorded = targets.find(t => t.week_start === week)?.session_target, target = recorded ?? (week >= current ? normalTarget : null)
  return { actual, target, adherence: target !== null && target > 0 ? actual / target * 100 : null, locked: week < current }
}
export function validateWeekTarget(week: string, target: number, current: string) { if (!validDate(week) || weekMonday(week) !== week || week < current || !Number.isInteger(target) || target < 0 || target > 14) throw new Error('Choose a current or future Monday and a whole-number target from 0 to 14.') }
export function createWeeklyTargetRepository(client: Pick<typeof supabase, 'auth' | 'from' | 'rpc'>) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw error; if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  return {
    async load(userId: string) { await account(userId); const [profile, targets] = await Promise.all([client.from('profiles').select('id,timezone,weekly_target').eq('id', userId).single(), client.from('weekly_training_targets').select('user_id,week_start,session_target').eq('user_id', userId).order('week_start')]); if (profile.error) throw profile.error; if (targets.error) throw targets.error; await account(userId); if (profile.data?.id !== userId || targets.data?.some(row => row.user_id !== userId)) throw new Error('Weekly targets belong to another account.'); return { normalTarget: profile.data.weekly_target as number, timezone: profile.data.timezone as string, targets: targets.data as WeekTarget[] ?? [] } },
    async save(userId: string, week: string, target: number, timezone: string) { validateWeekTarget(week, target, weekMonday(dateInZone(new Date(), timezone))); await account(userId); const { data, error } = await client.rpc('arc_fit_set_week_target', { p_week_start: week, p_session_target: target }); if (error) throw error; await account(userId); if (data?.user_id !== userId || data?.week_start !== week || data?.session_target !== target) throw new Error('Weekly target save was not confirmed.'); return data as WeekTarget },
  }
}
export const weeklyTargetRepository = createWeeklyTargetRepository(supabase)
