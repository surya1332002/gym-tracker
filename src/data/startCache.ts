import Dexie from 'dexie'
import type { Table } from 'dexie'
import { seal, open, registerEncryptedDataProbe } from './vault'
import type { EncryptedBlob } from './vault'
import type { PersonalExercise } from '../features/exercises/personal'
import type { PerformanceReference } from '../features/workout/performanceReferences'
import { prefillNewSession } from '../features/workout/performanceReferences'
import type { ProgrammeDay, SavedProgramme } from '../features/workout/programmes'
import type { WorkoutDraft } from '../features/workout/planner'
import { makeSession } from '../features/workout/sessions'
import type { WorkoutSession } from '../features/workout/sessions'
import { sessionRepository } from '../features/workout/sessions'
import { programmeRepository } from '../features/workout/programmes'
import { listPersonalExercises } from '../features/exercises/personal'
import { referenceRepository } from '../features/workout/performanceReferences'
import { createSettingsRepository } from '../features/profile/settings'
import { workoutStore } from './workoutStore'
export type StartPersonalExercise = PersonalExercise & { last_machine_preset_id?: string | null }
export type StartLibrary = { userId: string; programmes: SavedProgramme[]; personal: StartPersonalExercise[]; settings: { id?: string; exercise_id: string; user_id?: string }[]; previous: PerformanceReference[]; smartPrefill: boolean }
export type CachedProgramme = { userId: string; programme: SavedProgramme; draft: WorkoutDraft; days: ProgrammeDay[] }
type CachedRow = { key: string; userId: string; blob: EncryptedBlob; updatedAt: number }
type Codec = { seal: (userId: string, value: unknown, key: string) => EncryptedBlob; open: <T>(userId: string, blob: EncryptedBlob, key: string) => T }
export class StartDatabase extends Dexie { caches!: Table<CachedRow, string>; constructor(name = 'arc-fit-start-cache-v1') { super(name); this.version(1).stores({ caches: 'key,userId' }) } }
export const startDb = new StartDatabase()
export function createStartCache(db = startDb, codec: Codec = { seal, open }) {
  const key = (userId: string, id: string) => `arc-fit-start:${userId}:${id}`
  async function save(userId: string, id: string, value: { userId: string }) { if (value.userId !== userId) throw new Error('Start cache belongs to another account.'); const identity = key(userId, id), blob = codec.seal(userId, value, identity); await db.caches.put({ key: identity, userId, blob, updatedAt: Date.now() }) }
  async function load<T extends { userId: string }>(userId: string, id: string): Promise<T | null> { const row = await db.caches.get(key(userId, id)); if (!row) return null; if (row.userId !== userId) throw new Error('Start cache belongs to another account.'); const value = codec.open<T>(userId, row.blob, row.key); if (value.userId !== userId) throw new Error('Start cache belongs to another account.'); return value }
  return { saveLibrary: (value: StartLibrary) => save(value.userId, 'library', value), library: (userId: string) => load<StartLibrary>(userId, 'library'), saveProgramme: (value: CachedProgramme) => save(value.userId, value.programme.id, value), programme: (userId: string, id: string) => load<CachedProgramme>(userId, id), hasPrivateData: (userId: string) => db.caches.where('userId').equals(userId).count().then(count => count > 0) }
}
export const startCache = createStartCache()
registerEncryptedDataProbe(userId => startCache.hasPrivateData(userId))
export async function availableActiveWorkouts(userId: string, online = navigator.onLine) {
  if (online) try { const local=await workoutStore.list(userId); const [active,finished]=await Promise.all([sessionRepository.list(userId,'in_progress'),local.some(row=>!row.session.completedAt)?sessionRepository.list(userId,'completed'):Promise.resolve([])]); for(const row of [...active,...finished.filter(row=>local.some(item=>item.id===row.id&&!item.session.completedAt))]) await workoutStore.refresh(await sessionRepository.load(userId,row.id)) } catch (error) { if (/matching signed-in|another account|account changed|Authentication required/i.test((error as Error).message ?? '')) throw error }
  return (await workoutStore.list(userId)).filter(row => !row.session.completedAt && !row.session.deletedAt)
}
export async function loadStartLibrary(userId: string, online = navigator.onLine): Promise<{ library: StartLibrary; offline: boolean }> {
  let failure: unknown
  if (online) try {
    const [programmes, personal, settings, preferences, active, completed] = await Promise.all([programmeRepository.listProgrammes(userId), listPersonalExercises(userId), sessionRepository.settings(userId), createSettingsRepository().loadPreferences(userId), sessionRepository.list(userId, 'in_progress'), sessionRepository.list(userId, 'completed')])
    const local = await workoutStore.list(userId)
    const toCache = [...active, ...completed.filter(row => local.some(item => item.id === row.id && !item.session.completedAt))]
    for (const row of toCache) await workoutStore.refresh(await sessionRepository.load(userId, row.id))
    const previous = await referenceRepository.previous(userId, personal.map(row => row.id))
    const library: StartLibrary = { userId, programmes, personal, settings, previous, smartPrefill: preferences.smart_prefill }
    await startCache.saveLibrary(library); return { library, offline: false }
  } catch (error) { if (/matching signed-in|another account|account changed|Authentication required/i.test((error as Error).message ?? '')) throw error; failure = error }
  const cached = await startCache.library(userId)
  if (!cached) throw failure ?? new Error('Connect once and open your saved programme to prepare it for offline workouts.')
  const programmes = (await Promise.all(cached.programmes.map(async p => await startCache.programme(userId, p.id) ? p : null))).filter((p): p is SavedProgramme => p !== null)
  return { library: { ...cached, programmes }, offline: true }
}
export async function loadStartProgramme(userId: string, programme: SavedProgramme, online = navigator.onLine): Promise<{ bundle: CachedProgramme; offline: boolean }> {
  let failure: unknown
  if (online) try { const [draft, days] = await Promise.all([programmeRepository.loadProgramme(userId, programme), programmeRepository.listProgrammeDays(userId, programme.id, programme.revision)]); const bundle = { userId, programme, draft, days }; await startCache.saveProgramme(bundle); return { bundle, offline: false } } catch (error) { failure = error }
  const bundle = await startCache.programme(userId, programme.id)
  if (!bundle) throw failure ?? new Error('This programme has not been prepared for offline use. Open it once while connected.')
  return { bundle, offline: true }
}
export function makeCachedSession(library: StartLibrary, programme: CachedProgramme | null, dayIndex: number | null, random: StartPersonalExercise[] = []): WorkoutSession {
  if (programme && (programme.userId !== library.userId || programme.programme.user_id !== library.userId || programme.days.some(day => day.user_id !== library.userId || day.programme_id !== programme.programme.id))) throw new Error('Programme belongs to another account.')
  const day = programme && dayIndex !== null ? programme.draft.days[dayIndex] : { name: 'Random Workout', exercises: random.map(row => ({ exerciseId: row.id, name: row.name, sets: null, min: null, max: null })) }
  if (!day || !day.exercises.length) throw new Error('Choose at least one saved exercise.')
  const dayId = programme && dayIndex !== null ? programme.days[dayIndex]?.id : null
  if (programme && !dayId) throw new Error('Saved day identity is unavailable. Reconnect and reload this programme.')
  const selectedSettings = day.exercises.flatMap(plan => { const row = library.personal.find(e => e.id === plan.exerciseId), options = library.settings.filter(s => s.exercise_id === plan.exerciseId); if (!row || row.user_id !== library.userId) throw new Error('Exercise is not available in this account.'); if (row.last_machine_preset_id) return options.filter(s => s.id === row.last_machine_preset_id); return options.length === 1 ? options : [] })
  const fresh = makeSession(library.userId, dayId ?? null, day, library.personal, selectedSettings)
  return library.smartPrefill ? prefillNewSession(fresh, library.previous) : fresh
}
