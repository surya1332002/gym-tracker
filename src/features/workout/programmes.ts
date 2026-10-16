import { supabase } from '../../lib/supabase'
import { splits, validatePlan } from './planner'
import type { WorkoutDraft } from './planner'
import { listDayExercises } from './routines'
import { lbToKg, kgToLb } from './sessions'

export const programmePersistenceEnabled = true
export const persistenceBlocker = 'Apply the catalogue/programme migration in Supabase before saving programmes.'
export function programmeError(error: unknown): Error {
 const value = error as { code?: string; message?: string }
 return new Error(['42P01','42703','PGRST202','PGRST204','PGRST205'].includes(value?.code ?? '') ? persistenceBlocker : value?.message ?? 'Request failed. Your draft is retained; retry after checking your connection.')
}
export type ProgrammePayload = {
  name: string; split: string; muscles: string[]
  days: { name: string; exercises: { exercise_id: string; target_sets: number | null; target_weight_kg: number | null; target_reps_min: number | null; target_reps_max: number | null; plan_metadata?: {per_set_reps?: (number|null)[]; group?: import('./planner').PlannedExercise['group']} }[] }[]
}
export type ProgrammeReceipt = { id: string; user_id: string; revision: number }
export type SavedProgramme = ProgrammeReceipt & { name: string; split: string; muscles: string[] }
export type ProgrammeDay = { id: string; user_id: string; programme_id: string; programme_revision: number; name: string; sequence_number: number }
export type CatalogueMembership = { id: string; user_id: string; catalogue_id: string; is_archived: boolean }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function programmePayload(draft: WorkoutDraft): ProgrammePayload {
  if (!draft.name?.trim()) throw new Error('Give the programme a name.')
  if (!splits.includes(draft.split)) throw new Error('Choose a valid split.')
  const muscles = (draft.muscles ?? []).map(value => value.trim())
  const count = draft.split === 'Single muscle' ? 1 : draft.split === 'Two muscles' ? 2 : draft.split === 'Three muscles' ? 3 : 0
  if (muscles.length !== count || muscles.some(value => !value)) throw new Error('Complete the muscle configuration for this split.')
  return {
    name: draft.name.trim(), split: draft.split, muscles,
    days: draft.days.map(day => {
      if (!day.name.trim()) throw new Error('Every day needs a name.')
      return { name: day.name.trim(), exercises: day.exercises.map(exercise => {
        const error = validatePlan(exercise)
        if (error) throw new Error(error)
        if (!uuid.test(exercise.exerciseId)) throw new Error('Use a personal exercise identity from My List, not a shared catalogue ID.')
        return { exercise_id: exercise.exerciseId, target_sets: exercise.sets, target_weight_kg: exercise.startingWeightLb?.trim() ? lbToKg(Number(exercise.startingWeightLb)) : null, target_reps_min: exercise.min, target_reps_max: exercise.max, ...(exercise.perSetReps || exercise.group ? {plan_metadata:{...(exercise.perSetReps?{per_set_reps:exercise.perSetReps}:{}),...(exercise.group?{group:exercise.group}:{})}}:{}) }
      }) }
    }),
  }
}

// Factory supports isolated mock checks without network, credentials or writes.
// Production requests use authenticated ONLINE save RPCs,
// not the deferred exclusive-writer offline workout synchronisation gateway.
export type ProgrammeAttempt = { saveId: string; draft: WorkoutDraft }
export function programmeAttempt(draft: WorkoutDraft, pending: ProgrammeAttempt | null, saveId: string): ProgrammeAttempt {
  // Retry is explicitly the previous version, even if the editable draft has changed.
  return pending ?? { saveId, draft: structuredClone(draft) }
}
export function createProgrammeRepository(client: Pick<typeof supabase, 'auth' | 'from' | 'rpc'>, released = true) {
  async function account(userId: string) {
    if (!released) throw new Error(persistenceBlocker)
    const { data: { session }, error } = await client.auth.getSession()
    if (error) throw programmeError(error)
    if (!userId || session?.user.id !== userId) throw new Error('A matching signed-in account is required.')
  }
  function owned<T extends { user_id: string }>(row: T, userId: string): T {
    if (!row || row.user_id !== userId) throw new Error('Persistence response belongs to another account.')
    return row
  }
  return {
    async selectCatalogue(userId: string, catalogueId: string): Promise<CatalogueMembership> {
      if (!catalogueId.trim()) throw new Error('Catalogue identity required.')
      await account(userId)
      const { data, error } = await client.rpc('arc_fit_select_catalogue', { p_catalogue_id: catalogueId })
      if (error) throw programmeError(error)
      await account(userId)
      const row = owned(data as CatalogueMembership, userId)
      if (row.catalogue_id !== catalogueId || !uuid.test(row.id) || row.is_archived !== false) throw new Error('Catalogue membership was not confirmed.')
      return row
    },
    async listMemberships(userId: string): Promise<CatalogueMembership[]> {
      await account(userId)
      const { data, error } = await client.from('exercises').select('id,user_id,catalogue_id,is_archived').eq('user_id', userId).not('catalogue_id', 'is', null)
      if (error) throw programmeError(error)
      await account(userId)
      return (data ?? []).map(row => owned(row as CatalogueMembership, userId))
    },
    async listProgrammes(userId: string): Promise<SavedProgramme[]> {
      await account(userId)
      const { data, error } = await client.from('workout_programmes').select('id,user_id,name,split,muscles,revision').eq('user_id', userId).eq('is_archived', false).order('created_at')
      if (error) throw programmeError(error)
      await account(userId)
      return (data ?? []).map(row => owned(row as SavedProgramme, userId))
    },
    async listProgrammeDays(userId: string, programmeId: string, revision: number): Promise<ProgrammeDay[]> {
      if (!uuid.test(programmeId) || !Number.isInteger(revision) || revision < 1) throw new Error('A saved programme identity and revision are required.')
      await account(userId)
      const { data, error } = await client.from('routine_days').select('id,user_id,programme_id,programme_revision,name,sequence_number').eq('user_id', userId).eq('programme_id', programmeId).eq('programme_revision', revision).order('sequence_number')
      if (error) throw programmeError(error)
      await account(userId)
      return (data ?? []).map(row => {
        const day = owned(row as ProgrammeDay, userId)
        if (day.programme_id !== programmeId || day.programme_revision !== revision) throw new Error('Programme days do not match the requested revision.')
        return day
      })
    },
    async loadProgramme(userId: string, programme: SavedProgramme): Promise<WorkoutDraft> {
      owned(programme, userId)
      if (!splits.includes(programme.split as WorkoutDraft['split'])) throw new Error('Unsupported saved programme split.')
      const days = await this.listProgrammeDays(userId, programme.id, programme.revision)
      const entries = await Promise.all(days.map(day => listDayExercises(userId, day.id, client)))
      const ids = [...new Set(entries.flat().map(entry => entry.exercise_id))]
      let names: Record<string, string> = {}
      if (ids.length) {
        await account(userId)
        const { data, error } = await client.from('exercises').select('id,user_id,name').eq('user_id', userId).in('id', ids)
        if (error) throw programmeError(error)
        names = Object.fromEntries((data ?? []).map(row => { owned(row, userId); return [row.id, row.name] }))
      }
      await account(userId)
      return { name: programme.name, split: programme.split as WorkoutDraft['split'], muscles: programme.muscles, days: days.map((day, index) => ({ name: day.name, exercises: entries[index].map(entry => ({ exerciseId: entry.exercise_id, name: names[entry.exercise_id] ?? 'Exercise name unavailable', sets: entry.target_sets, startingWeightLb: entry.target_weight_kg == null ? '' : String(kgToLb(Number(entry.target_weight_kg))), min: entry.target_reps_min, max: entry.target_reps_max, ...(entry.plan_metadata?.per_set_reps?{perSetReps:entry.plan_metadata.per_set_reps}:{}), ...(entry.plan_metadata?.group?{group:entry.plan_metadata.group}:{}) })) })) }
    },
    async saveProgramme(userId: string, id: string, expectedRevision: number, saveId: string, draft: WorkoutDraft): Promise<ProgrammeReceipt> {
      if (!uuid.test(id) || !uuid.test(saveId) || !Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('Stable save identities and a valid revision are required.')
      const payload = programmePayload(draft) // Snapshot before any asynchronous work.
      await account(userId)
      const { data, error } = await client.rpc('arc_fit_save_programme', { p_id: id, p_expected_revision: expectedRevision, p_save_id: saveId, p_payload: payload })
      if (error) throw programmeError(error) // Ambiguous failures must retain draft + save identity.
      await account(userId)
      const receipt = owned(data as ProgrammeReceipt, userId)
      if (receipt.id !== id || !Number.isInteger(receipt.revision) || receipt.revision !== expectedRevision + 1) throw new Error('Programme save was not confirmed.')
      return receipt
    },
  }
}
export const programmeRepository = createProgrammeRepository(supabase, programmePersistenceEnabled)
