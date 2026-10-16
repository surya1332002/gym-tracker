import { supabase } from '../../lib/supabase'
import { createUuid } from '../../lib/uuid'
import type { WorkoutSession } from './sessions'
import { kgToLb } from './sessions'
export const referenceMigrationMessage = 'Previous-performance references need the exercise_performance_references migration. Workout logging remains available.'
export type ReferenceSet = { number: number; weight_lb: number | null; reps: number | null; raw_weight: string; raw_reps: string }
export type PerformanceReference = { id: string; user_id: string; exercise_id: string; routine_day_id: string | null; performance_date: string | null; source_key: string; recorded_sets: ReferenceSet[]; weight_unit: 'lb'; machine_settings: string; per_side_qualifiers: string; original_notes: string; source_fields: Record<string, string> }
export type ReferenceInput = Omit<PerformanceReference, 'id' | 'user_id'>
export type PreparedReference = Omit<ReferenceInput, 'exercise_id' | 'routine_day_id'> & { movementKey: string; catalogueId: string | null; name: string; equipment: string | null; day: string; order: number }
export type ReferenceManifest = { version: number; programmeName: string; records: PreparedReference[] }
export function referenceValueKey(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(referenceValueKey).join(',') + ']'
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + referenceValueKey(item)).join(',') + '}'
  return JSON.stringify(value)
}
function failure(error: unknown) {
  const value = error as { code?: string; message?: string }
  return new Error(['42P01', '42703', 'PGRST204', 'PGRST205'].includes(value?.code ?? '') ? referenceMigrationMessage : value?.message ?? 'Previous performance could not be loaded. Retry when connected.')
}
export function validateReference(row: ReferenceInput) {
  if (!row.source_key?.trim() || row.weight_unit !== 'lb' || row.performance_date !== null || !row.exercise_id || !row.routine_day_id) throw new Error('This import requires an owned exercise/day and an undated lb reference.')
  if (!Array.isArray(row.recorded_sets) || !row.recorded_sets.length || row.recorded_sets.length > 20) throw new Error('Recorded sets are required.')
  const numbers = new Set<number>()
  for (const set of row.recorded_sets) {
    if (!Number.isInteger(set.number) || set.number < 1 || numbers.has(set.number)) throw new Error('Duplicate or invalid recorded set number.')
    numbers.add(set.number)
    if (typeof set.raw_weight !== 'string' || typeof set.raw_reps !== 'string') throw new Error('Original recorded values are required.')
    if (set.weight_lb !== null && (!Number.isFinite(set.weight_lb) || set.weight_lb < 0)) throw new Error('Invalid recorded lb weight.')
    if (set.reps !== null && (!Number.isInteger(set.reps) || set.reps < 1)) throw new Error('Invalid recorded reps.')
    if ((set.weight_lb === null) !== !set.raw_weight.trim() || (set.reps === null) !== !set.raw_reps.trim()) throw new Error('Missing values must remain missing.')
    if ((set.weight_lb !== null && Number(set.raw_weight) !== set.weight_lb) || (set.reps !== null && Number(set.raw_reps) !== set.reps)) throw new Error('Parsed values must match the original recorded values.')
    if (!set.raw_weight.trim() && !set.raw_reps.trim()) throw new Error('Blank sets must not be invented.')
  }
  if ([row.machine_settings, row.per_side_qualifiers, row.original_notes].some(value => typeof value !== 'string') || !row.source_fields || Object.values(row.source_fields).some(value => typeof value !== 'string')) throw new Error('Preserve original source fields as text.')
}
export function createReferenceRepository(client: Pick<typeof supabase, 'auth' | 'from'>) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw failure(error); if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  function owned(rows: PerformanceReference[], userId: string) { if (rows.some(row => row.user_id !== userId)) throw new Error('Reference belongs to another account.'); return rows }
  return {
    async list(userId: string, exerciseIds?: string[]): Promise<PerformanceReference[]> {
      await account(userId)
      let query = client.from('exercise_performance_references').select('*').eq('user_id', userId)
      if (exerciseIds) { if (!exerciseIds.length) return []; query = query.in('exercise_id', exerciseIds) }
      const { data, error } = await query; if (error) throw failure(error)
      await account(userId); return owned(data ?? [], userId)
    },
    async previous(userId: string, exerciseIds: string[], excludeWorkoutId?: string): Promise<PerformanceReference[]> {
      const references = await this.list(userId, exerciseIds)
      if (!exerciseIds.length) return references
      await account(userId)
      const history = await client.from('workouts').select('id,user_id,routine_day_id,workout_date,started_at,completed_at,deleted_at,status').eq('user_id', userId).in('status', ['in_progress','completed']).order('workout_date', { ascending: false }).limit(500)
      if (history.error) throw failure(history.error)
      const workouts = (history.data ?? []).filter(row=>!row.deleted_at && row.id!==excludeWorkoutId && /^\d{4}-\d{2}-\d{2}$/.test(row.workout_date??'') && new Date(row.workout_date).toISOString().slice(0,10)===row.workout_date)
      if (workouts.some(row => row.user_id !== userId)) throw new Error('History belongs to another account.')
      if (!workouts.length) return references
      const exercises = await client.from('workout_exercises').select('id,user_id,exercise_id,workout_id,machine_preset_snapshot,notes').eq('user_id', userId).in('workout_id', workouts.map(row => row.id)).in('exercise_id', exerciseIds)
      if (exercises.error) throw failure(exercises.error)
      if (exercises.data?.some(row => row.user_id !== userId)) throw new Error('History belongs to another account.')
      if (!exercises.data?.length) return references
      const sets = await client.from('workout_sets').select('id,user_id,workout_exercise_id,set_number,weight_kg,reps,input_weight,input_unit').eq('user_id', userId).in('workout_exercise_id', exercises.data.map(row => row.id)).eq('is_completed', true).order('set_number')
      if (sets.error) throw failure(sets.error)
      if (sets.data?.some(row => row.user_id !== userId)) throw new Error('History belongs to another account.')
      await account(userId)
      return [...references, ...exercises.data.flatMap(row => {
        const workout = workouts.find(item => item.id === row.workout_id)
        const performed = (sets.data ?? []).filter(set => set.workout_exercise_id === row.id)
        if (!workout || !performed.length) return []
        return [{ id: row.id, user_id: userId, exercise_id: row.exercise_id, routine_day_id: workout.routine_day_id, performance_date: workout.workout_date, source_key: `history:${row.id}`, weight_unit: 'lb' as const, machine_settings: row.machine_preset_snapshot?.settings?.length ? JSON.stringify(row.machine_preset_snapshot.settings) : '', per_side_qualifiers: '', original_notes: row.notes ?? '', source_fields: { source: workout.completed_at?'Completed sets from saved workout':'Completed sets from unfinished workout', completed_at: workout.completed_at ?? workout.started_at ?? '' }, recorded_sets: performed.map(set => {
          const weight = set.weight_kg === null ? null : set.input_unit==='lb' && set.input_weight!=null ? Number(set.input_weight) : kgToLb(Number(set.weight_kg))
          return { number: set.set_number, weight_lb: weight, reps: set.reps, raw_weight: weight === null ? '' : String(weight), raw_reps: set.reps === null ? '' : String(set.reps) }
        }) }]
      })]
    },
    async import(userId: string, inputs: ReferenceInput[]) {
      inputs.forEach(validateReference)
      if (new Set(inputs.map(row => row.source_key)).size !== inputs.length) throw new Error('Duplicate source key in import.')
      const existing = await this.list(userId)
      const values = inputs.map(row => ({ ...row, user_id: userId, id: existing.find(item => item.source_key === row.source_key)?.id ?? createUuid() }))
      // Same source identity merges a retry; unrelated records are never deleted.
      for (let start = 0; start < values.length; start += 50) {
        await account(userId)
        const batch = values.slice(start, start + 50)
        const { data, error } = await client.from('exercise_performance_references').upsert(batch, { onConflict: 'user_id,source_key' }).select('*')
        if (error) throw failure(error)
        await account(userId)
        if (!data || owned(data, userId).length !== batch.length) throw new Error('Reference import was not confirmed. Retry with the same source file.')
      }
      const saved = await this.list(userId)
      for (const row of inputs) {
        const matches = saved.filter(item => item.source_key === row.source_key)
        if (matches.length !== 1 || Object.keys(row).some(key => referenceValueKey(matches[0][key as keyof PerformanceReference]) !== referenceValueKey(row[key as keyof ReferenceInput]))) throw new Error('Imported reference values did not verify.')
      }
      return { records: inputs.length, sets: inputs.reduce((sum, row) => sum + row.recorded_sets.length, 0), exercises: new Set(inputs.map(row => row.exercise_id)).size }
    },
  }
}
export const referenceRepository = createReferenceRepository(supabase)
export function chooseReference(rows: PerformanceReference[], exerciseId: string, dayId: string | null): PerformanceReference | null {
  const matching = rows.filter(row => row.exercise_id === exerciseId)
  const preferred = matching.filter(row => row.routine_day_id === dayId)
  const pool = preferred.length ? preferred : matching
  const sameDayDated = preferred.filter(row => row.performance_date)
  const dated = (sameDayDated.length ? sameDayDated : matching.filter(row => row.performance_date)).sort((a, b) => b.performance_date!.localeCompare(a.performance_date!) || (b.source_fields.completed_at ?? '').localeCompare(a.source_fields.completed_at ?? ''))
  if (dated.length) return dated[0]
  // An undated source has no chronological ordering. Only one unambiguous reference may prefill.
  return pool.length === 1 ? pool[0] : null
}
export function prefillNewSession(session: WorkoutSession, rows: PerformanceReference[]): WorkoutSession {
  return { ...session, exercises: session.exercises.map(exercise => {
    const previous = chooseReference(rows, exercise.exerciseId, session.dayId)
    if (!previous) return exercise
    // Preserved total/per-dumbbell text can conflict with numeric load convention.
    // Display it, but do not guess which per-side weight the user wants to log.
    const ambiguousLoad = !!previous.per_side_qualifiers || !!previous.source_fields['Confirmed interpretation']?.includes('conflicting')
    return { ...exercise, sets: exercise.sets.map(set => {
      const source = previous.recorded_sets.find(item => item.number === set.number)
      if (!source || set.completed || set.reps || (set.lb && set.lb !== exercise.startingWeightLb)) return set
      return { ...set, lb: set.lb || (!ambiguousLoad && source.weight_lb !== null ? String(source.weight_lb) : ''), reps: source.reps !== null ? String(source.reps) : '', completed: false, completedAt: null }
    }) }
  }) }
}
