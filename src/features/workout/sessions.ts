import { supabase } from '../../lib/supabase'
import { createUuid } from '../../lib/uuid'
import type { PersonalExercise } from '../exercises/personal'
import { validatePlan } from './planner'
import type { WorkoutDraft } from './planner'

export type LoggedSet = { id: string; number: number; lb: string; reps: string; completed: boolean; completedAt: string | null; notes: string; rpe?: string; weightKg?: number | null; setType?: string; plannedReps?: number|null }
export type SessionExercise = { id: string; exerciseId: string; name: string; muscle?: string; perSetReps?: (number|null)[]; startingWeightLb?: string; unit?: 'kg' | 'lb'; increment?: number | null; savePreferences?: boolean; preferencesConfigured?: boolean; selectedPresetId?: string | null; setOrder?: string[]; group?: {id:string;type:'superset'|'triset'|'circuit';name:string}; equipment: string | null; notes: string; instructions: string; min: number | null; max: number | null; settings: unknown[]; nextNumber: number; sets: LoggedSet[] }
export type DurationState = {pausedAt:string|null; pausedSeconds:number; overrideSeconds:number|null}
export type WorkoutSession = { id: string; userId: string; dayId: string | null; name: string; date: string; startedAt: string; completedAt: string | null; revision?: number; advanceRotation?:boolean;completionKind?:'complete'|'incomplete'; deletedAt?:string|null; notes?:string; duration?:DurationState; exercises: SessionExercise[] }
export const lbToKg = (lb: number) => lb * 0.45359237
export const kgToLb = (kg: number) => kg / 0.45359237
export function newSet(number: number): LoggedSet { return { id: createUuid(), number, lb: '', reps: '', completed: false, completedAt: null, notes: '' } }
export function makeSession(userId: string, dayId: string | null, day: WorkoutDraft['days'][number], personal: PersonalExercise[], settings: { exercise_id: string }[] = [], now = new Date()): WorkoutSession {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { id: createUuid(), userId, dayId, name: day.name, date, startedAt: now.toISOString(), completedAt: null, exercises: day.exercises.map(plan => {
    const planError = validatePlan(plan)
    if (planError) throw new Error(planError)
    const row = personal.find(item => item.id === plan.exerciseId)
    if (!row) throw new Error('Exercise settings are unavailable. Reload My List before starting.')
    return { id: createUuid(), exerciseId: row.id, name: row.name, muscle: row.primary_muscle ?? undefined, group:plan.group,perSetReps:plan.perSetReps, unit:row.weight_unit??'lb',increment:row.weight_increment,preferencesConfigured:row.weight_preferences_configured===true,startingWeightLb: plan.startingWeightLb?.trim() ?? '', equipment: row.equipment, notes: row.notes ?? '', instructions: row.instructions ?? '', min: plan.min, max: plan.max, settings: settings.filter(item => item.exercise_id === row.id), nextNumber: (plan.sets ?? 0) + 1, sets: Array.from({ length: plan.sets ?? 0 }, (_, i) => ({ ...newSet(i + 1), plannedReps:plan.perSetReps?.[i]??null, lb: plan.startingWeightLb?.trim() ?? '' })) }
  }) }
}
export function validateSession(session: WorkoutSession, finish = false) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(session.date)||!Number.isFinite(Date.parse(session.date))||new Date(session.date).toISOString().slice(0,10)!==session.date)throw new Error('Enter a valid workout date.')
  let completed = 0
  for (const exercise of session.exercises) for (const set of exercise.sets) {
    if (set.lb !== '' && (!Number.isFinite(Number(set.lb)) || Number(set.lb) < 0 || lbToKg(Number(set.lb)) > 2000)) throw new Error('Weight must be a non-negative number in lb.')
    if (set.reps !== '' && (!Number.isInteger(Number(set.reps)) || Number(set.reps) < 1 || Number(set.reps) > 1000)) throw new Error('Reps must be a whole number from 1 to 1000.')
    if(set.rpe && (!Number.isFinite(Number(set.rpe))||Number(set.rpe)<0||Number(set.rpe)>10))throw new Error('RPE must be between 0 and 10, or blank.')
    if (set.completed) { if (!set.reps) throw new Error('Enter repetitions before completing a set. Weight may be blank for bodyweight exercises.'); completed++ }
  }
  if (finish && !completed) throw new Error('Complete at least one actual set before finishing a workout.')
}
export function createSessionRepository(client: Pick<typeof supabase, 'auth' | 'from'>) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw error; if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  async function rows(table: string, userId: string, filter: (q: ReturnType<ReturnType<typeof client.from>['select']>) => any): Promise<any[]> {
    await account(userId)
    const { data, error } = await filter(client.from(table).select('*').eq('user_id', userId))
    if (error) throw error
    await account(userId)
    if ((data ?? []).some((row: any) => row.user_id !== userId)) throw new Error('Response belongs to another account.')
    return data ?? []
  }
  async function write(table: string, values: object[], userId: string) {
    if (!values.length) return
    await account(userId)
    const { data, error } = await client.from(table).upsert(values, { onConflict: 'id' }).select('id,user_id')
    if (error) throw error
    await account(userId)
    if (data?.length !== values.length || data.some(row => row.user_id !== userId)) throw new Error('Save was not confirmed. Your local progress is retained.')
  }
  return {
    list: (userId: string, status: 'in_progress' | 'completed') => rows('workouts', userId, q => q.eq('status', status).order('started_at', { ascending: false })),
    settings: (userId: string) => rows('machine_presets', userId, q => q),
    async load(userId: string, id: string): Promise<WorkoutSession> {
      const [workout] = await rows('workouts', userId, q => q.eq('id', id)); if (!workout) throw new Error('Workout not found in your account.')
      const exercises = await rows('workout_exercises', userId, q => q.eq('workout_id', id).order('position'))
      const sets = exercises.length ? await rows('workout_sets', userId, q => q.in('workout_exercise_id', exercises.map(row => row.id)).order('set_number')) : []
      return { id, userId, dayId: workout.routine_day_id, name: workout.routine_name_snapshot, date: workout.workout_date, startedAt: workout.started_at, completedAt: workout.completed_at, revision:workout.revision??0,advanceRotation:workout.advance_rotation??false,completionKind:workout.is_incomplete?'incomplete':'complete',deletedAt:workout.deleted_at??null,notes:workout.notes??'',duration:workout.duration_state??undefined,exercises: exercises.map(row => {
        const snapshot = row.machine_preset_snapshot ?? {}
        return { id: row.id, exerciseId: row.exercise_id, name: row.exercise_name_snapshot, muscle: snapshot.muscle, unit:snapshot.unit??'lb',increment:snapshot.increment??null,preferencesConfigured:snapshot.preferencesConfigured===true,group:snapshot.group,perSetReps:snapshot.perSetReps, startingWeightLb: snapshot.startingWeightLb ?? '', equipment: row.equipment_snapshot, notes: row.notes ?? '', instructions: snapshot.instructions ?? '', min: snapshot.min ?? null, max: snapshot.max ?? null, settings: snapshot.settings ?? [], selectedPresetId:snapshot.selectedPresetId,setOrder:snapshot.setOrder, nextNumber: snapshot.nextNumber ?? Math.max(0, ...sets.filter(set => set.workout_exercise_id === row.id).map(set => set.set_number)) + 1, sets: sets.filter(set => set.workout_exercise_id === row.id).map(set => ({ id: set.id, number: set.set_number, lb: set.input_unit==='lb' && set.input_weight!=null ? set.input_weight : set.weight_kg == null ? '' : String(kgToLb(Number(set.weight_kg))), weightKg:set.weight_kg==null?null:Number(set.weight_kg),setType:set.set_type,plannedReps:snapshot.perSetReps?.[set.set_number-1]??null,rpe:set.rpe==null?'':String(set.rpe),reps: set.reps == null ? '' : String(set.reps), completed: set.is_completed, completedAt: set.completed_at, notes: set.notes ?? '' })).sort((a,b)=>snapshot.setOrder?.length ? (snapshot.setOrder.includes(a.id)?snapshot.setOrder.indexOf(a.id):1000+a.number)-(snapshot.setOrder.includes(b.id)?snapshot.setOrder.indexOf(b.id):1000+b.number):a.number-b.number) }
      }) }
    },
    async save(session: WorkoutSession, finish = false) {
      validateSession(session, finish)
      const userId = session.userId
      const [existing] = await rows('workouts', userId, q => q.eq('id', session.id))
      if (existing?.status === 'completed') {
        if (finish && existing.completed_at === session.completedAt) return
        throw new Error('This workout is already finished. Reload its saved history.')
      }
      await write('workouts', [{ id: session.id, user_id: userId, routine_day_id: session.dayId, routine_name_snapshot: session.name, workout_date: session.date, started_at: session.startedAt, status: 'in_progress', updated_at: new Date().toISOString() }], userId)
      await write('workout_exercises', session.exercises.map((exercise, index) => ({ id: exercise.id, user_id: userId, workout_id: session.id, exercise_id: exercise.exerciseId, exercise_name_snapshot: exercise.name, equipment_snapshot: exercise.equipment, position: index + 1, notes: exercise.notes, machine_preset_snapshot: { muscle: exercise.muscle, unit:exercise.unit, increment:exercise.increment, preferencesConfigured:exercise.preferencesConfigured===true, startingWeightLb: exercise.startingWeightLb, min: exercise.min, max: exercise.max, instructions: exercise.instructions, settings: exercise.settings, nextNumber: exercise.nextNumber } })), userId)
      const sets = session.exercises.flatMap(exercise => exercise.sets.map(set => ({ id: set.id, user_id: userId, workout_exercise_id: exercise.id, set_number: set.number, set_type: 'working', weight_kg: set.lb === '' ? null : lbToKg(Number(set.lb)), reps: set.reps === '' ? null : Number(set.reps), is_completed: set.completed, completed_at: set.completed ? set.completedAt : null, notes: set.notes || null, updated_at: new Date().toISOString() })))
      await write('workout_sets', sets, userId)
      // Only remove explicitly removed sets inside this active session's exercise identities.
      for (const exercise of session.exercises) {
        await account(userId)
        let query = client.from('workout_sets').delete().eq('user_id', userId).eq('workout_exercise_id', exercise.id)
        if (exercise.sets.length) query = query.not('id', 'in', `(${exercise.sets.map(set => set.id).join(',')})`)
        const { error } = await query; if (error) throw error
      }
      if (session.exercises.length) {
        const savedSets = await rows('workout_sets', userId, q => q.in('workout_exercise_id', session.exercises.map(exercise => exercise.id)))
        const expected = new Set(sets.map(set => set.id))
        if (savedSets.length !== expected.size || savedSets.some(set => !expected.has(set.id))) throw new Error('Set changes were not confirmed. Your local progress is retained; retry saving.')
      }
      if (finish) {
        await account(userId)
        const { data, error } = await client.from('workouts').update({ status: 'completed', completed_at: session.completedAt, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('id', session.id).eq('status', 'in_progress').select('id,user_id').single()
        if (error) throw error
        if (data?.id !== session.id || data.user_id !== userId) throw new Error('Completion was not confirmed.')
      }
      await account(userId)
    },
  }
}
export function createAtomicSessionRepository(client: Pick<typeof supabase,'auth'|'from'|'rpc'>){
 const reader=createSessionRepository(client)
 const pending=new Map<string,{operation:string;revision:number;session:WorkoutSession;action:'save'|'edit'|'trash'|'restore'}>()
 async function writeAttempt(session:WorkoutSession,operationId:string,revision:number,action:'save'|'edit'|'trash'|'restore'='save'){
  validateSession(session,!!session.completedAt && !['trash','restore'].includes(action))
  const {data:auth,error:authError}=await client.auth.getSession();if(authError)throw authError
  if(auth.session?.user.id!==session.userId)throw new Error('A matching signed-in account is required.')
  const {data,error}=await client.rpc('arc_fit_sync_workout',{p_id:session.id,p_revision:revision,p_operation:operationId,p_payload:session,p_action:action})
  if(error){if(error.code==='40001')throw Object.assign(new Error('Another device changed this workout. Both versions are kept; review the conflict.'),{code:'40001'});throw new Error('Cloud save failed. Your device copy is retained; reconnect and retry.')}
  if(data?.id!==session.id||data?.user_id!==session.userId||!Number.isInteger(data?.revision))throw new Error('Workout save could not be confirmed.')
  const {data:after,error:afterError}=await client.auth.getSession();if(afterError||after.session?.user.id!==session.userId)throw new Error('The signed-in account changed. Keep your device copy and sign in again.')
  return data as {id:string;user_id:string;revision:number}
 }
 return {...reader,
  async list(userId:string,status:'in_progress'|'completed') {return (await reader.list(userId,status)).filter(row=>!row.deleted_at)},
  writeAttempt,
  async save(session:WorkoutSession,finish=false){validateSession(session,finish);const k=`${session.userId}:${session.id}`;if(!pending.has(k))pending.set(k,{operation:createUuid(),revision:session.revision??0,session:structuredClone(session),action:'save'});const p=pending.get(k)!;const receipt=await writeAttempt(p.session,p.operation,p.revision,p.action);session.revision=receipt.revision;pending.delete(k)},
  async historyAction(session:WorkoutSession,action:'edit'|'trash'|'restore'){const k=`${session.userId}:${session.id}`;if(!pending.has(k))pending.set(k,{operation:createUuid(),revision:session.revision??0,session:structuredClone(session),action});const p=pending.get(k)!;const receipt=await writeAttempt(p.session,p.operation,p.revision,p.action);session.revision=receipt.revision;pending.delete(k)},
 }
}
export const sessionRepository = createAtomicSessionRepository(supabase)
export const sessionCacheKey = (userId: string, id: string) => `arc-fit-active-v1:${userId}:${id}`
