import { supabase } from '../../lib/supabase'
import { createUuid } from '../../lib/uuid'
import { programmeRepository } from './programmes'
import type { SavedProgramme } from './programmes'
import type { WorkoutDraft } from './planner'
import type { PersonalExercise } from '../exercises/personal'
export type RoutineReplacementAttempt = { userId: string; programmeId: string; expectedRevision: number; saveId: string; draft: WorkoutDraft }
export function replacementDraft(draft: WorkoutDraft, retained: { name: string; sequence_number: number }, originalExerciseId: string, replacement: PersonalExercise): WorkoutDraft {
  if (replacement.is_archived) throw new Error('Choose an active exercise for future workouts.')
  const index = retained.sequence_number - 1, day = draft.days[index]
  if (!day || day.name !== retained.name || draft.days.filter(d => d.name === retained.name).length !== 1) throw new Error('The saved workout day changed or is ambiguous. Edit the programme explicitly instead.')
  const matches = day.exercises.map((exercise, i) => exercise.exerciseId === originalExerciseId ? i : -1).filter(i => i >= 0)
  if (matches.length !== 1) throw new Error('The original exercise slot changed or is ambiguous. Edit the programme explicitly instead.')
  const next = structuredClone(draft), slot = next.days[index].exercises[matches[0]]
  next.days[index].exercises[matches[0]] = { ...slot, exerciseId: replacement.id, name: replacement.name, startingWeightLb: '' }
  return next
}
export function createRoutineReplacementRepository(client: Pick<typeof supabase, 'auth' | 'from'> = supabase, programmes = programmeRepository) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw error; if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  return {
    async prepare(userId: string, retainedDayId: string | null, originalExerciseId: string, replacement: PersonalExercise): Promise<RoutineReplacementAttempt> {
      if (!retainedDayId || replacement.user_id !== userId) throw new Error('An owned saved workout day and replacement exercise are required.')
      await account(userId)
      const { data: day, error } = await client.from('routine_days').select('id,user_id,programme_id,name,sequence_number').eq('id', retainedDayId).eq('user_id', userId).single()
      if (error) throw error
      await account(userId)
      if (!day || day.user_id !== userId || !day.programme_id) throw new Error('This workout day is not linked to an owned programme.')
      const current = (await programmes.listProgrammes(userId)).find(p => p.id === day.programme_id)
      if (!current || current.user_id !== userId) throw new Error('The saved programme is unavailable. The active workout remains unchanged.')
      const draft = await programmes.loadProgramme(userId, current as SavedProgramme)
      return { userId, programmeId: current.id, expectedRevision: current.revision, saveId: createUuid(), draft: replacementDraft(draft, day, originalExerciseId, replacement) }
    },
    async save(attempt: RoutineReplacementAttempt) { await account(attempt.userId); return programmes.saveProgramme(attempt.userId, attempt.programmeId, attempt.expectedRevision, attempt.saveId, attempt.draft) },
  }
}
export const routineReplacementRepository = createRoutineReplacementRepository()
