import { workoutDb, workoutStore } from '../data/workoutStore'
import { isUnlocked, open } from '../data/vault'
import { workoutDraftDirty, type PlannerConfiguration, type ProgrammeSaveState } from '../features/workout/WorkoutDraft'
import type { WorkoutDraft } from '../features/workout/planner'
import { sessionRepository } from '../features/workout/sessions'
import { safeToActivate } from './otaPolicy'

// Read only. Inability to verify is a reason to defer, never to discard data.
export async function verifyUpdateSafety(userId: string): Promise<boolean> {
  if (!navigator.onLine || !isUnlocked(userId)) return false
  const pending = await workoutDb.outbox.count()
  const owners = await workoutDb.workouts.toArray()
  const activeEditor = (await workoutDb.editors.toArray()).some(row => row.expires > Date.now())
  if (pending || owners.some(row => row.userId !== userId) || activeEditor) return false
  const local = await workoutStore.list(userId)
  let dirtyDraft = false
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    // Legacy recovery copies may not yet have been migrated into encrypted IDB.
    if (key?.startsWith('arc-fit-active-v1:')) return false
    if (!key?.startsWith('arc-fit-programme-draft:')) continue
    if (key !== 'arc-fit-programme-draft:' + userId) return false
    const value = localStorage.getItem(key)
    if (!value) continue
    const saved = open<{ draft: WorkoutDraft | null; configuration: PlannerConfiguration; saveState: ProgrammeSaveState }>(userId, JSON.parse(value), key)
    dirtyDraft ||= workoutDraftDirty(saved.draft, saved.configuration, saved.saveState)
  }
  if (dirtyDraft || local.some(row => row.conflict || !row.session.completedAt && !row.session.deletedAt)) return false
  const active = await sessionRepository.list(userId, 'in_progress')
  // A second local read closes the check around the asynchronous owner-scoped read.
  return isUnlocked(userId) && safeToActivate({
    pending: await workoutDb.outbox.count(), foreignData: false,
    activeWorkout: active.some(row => !row.deleted_at), dirtyDraft,
    conflict: local.some(row => Boolean(row.conflict)), onlineVerified: true,
    activeEditor: (await workoutDb.editors.toArray()).some(row => row.expires > Date.now()),
  })
}
