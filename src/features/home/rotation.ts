import { supabase } from '../../lib/supabase'
import { programmeRepository } from '../workout/programmes'
import type { ProgrammeDay } from '../workout/programmes'
import type { WorkoutSession } from '../workout/sessions'
import { completedSessions } from '../progress/analytics'
export function latestQualifyingWorkout(sessions: WorkoutSession[]) { return [...completedSessions(sessions)].reverse().find(session => session.advanceRotation === true && session.dayId !== null) ?? null }
export function nextConfiguredDay(days: ProgrammeDay[], retained: { id: string; programme_id: string; name: string; sequence_number: number } | null): ProgrammeDay | null {
  if (!days.length) return null
  if (!retained || retained.programme_id !== days[0].programme_id) return days[0]
  const matches = days.map((day, index) => day.id === retained.id || day.name === retained.name && day.sequence_number === retained.sequence_number ? index : -1).filter(index => index >= 0)
  return matches.length === 1 ? days[(matches[0] + 1) % days.length] : null
}
export function createRotationRepository(client: Pick<typeof supabase, 'auth' | 'from'> = supabase, programmes = programmeRepository) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw error; if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  return { async load(userId: string, qualifying: WorkoutSession | null) {
    await account(userId); const available = await programmes.listProgrammes(userId); let retained: { id: string; user_id: string; programme_id: string; name: string; sequence_number: number } | null = null
    if (qualifying?.dayId) { if (qualifying.userId !== userId) throw new Error('Workout belongs to another account.'); const { data, error } = await client.from('routine_days').select('id,user_id,programme_id,name,sequence_number').eq('id', qualifying.dayId).eq('user_id', userId).maybeSingle(); if (error) throw error; if (data?.user_id !== undefined && data.user_id !== userId) throw new Error('Workout day belongs to another account.'); retained = data }
    await account(userId)
    const programme = available.find(p => p.id === retained?.programme_id) ?? available[0]
    if (!programme) return { programme: null, next: null }
    const days = await programmes.listProgrammeDays(userId, programme.id, programme.revision); await account(userId)
    return { programme, next: nextConfiguredDay(days, retained) }
  } }
}
export const rotationRepository = createRotationRepository()
