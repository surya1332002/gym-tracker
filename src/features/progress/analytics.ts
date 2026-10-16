import type { WorkoutSession } from '../workout/sessions'

const KG_PER_LB = 0.45359237
function knownKg(set: { lb: string; weightKg?: number | null }): number | null {
  if (set.weightKg !== undefined) return set.weightKg !== null && Number.isFinite(set.weightKg) && set.weightKg >= 0 ? set.weightKg : null
  return set.lb.trim() !== '' && Number.isFinite(Number(set.lb)) && Number(set.lb) >= 0 ? Number(set.lb) * KG_PER_LB : null
}
function isWorkingSet(set: { completed: boolean; reps: string; setType?: string }) { return set.completed && (!set.setType || set.setType === 'working') && Number.isInteger(Number(set.reps)) && Number(set.reps) > 0 }
export type ExercisePoint = { date: string; sessionId: string; exerciseId: string; name: string; weightKg: number | null; estimated1RmKg: number | null; volumeKg: number; workingSets: number; maxReps: number; loads: { kg: number; reps: number }[] }
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number), date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}
export function completedSessions(sessions: WorkoutSession[]) {
  return performanceSessions(sessions).filter(s => s.completedAt && (s as WorkoutSession & { completionKind?: string }).completionKind !== 'incomplete')
}
export function performanceSessions(sessions: WorkoutSession[]) { return [...new Map(sessions.filter(s => !s.deletedAt && validDate(s.date)).map(s => [s.id, s])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt)) }
// Epley is shown only for known positive loads and 1–10 repetitions; it is an estimate, not a tested maximum.
export function estimated1Rm(kg: number, reps: number): number | null { return kg > 0 && Number.isFinite(kg) && Number.isInteger(reps) && reps >= 1 && reps <= 10 ? (reps === 1 ? kg : kg * (1 + reps / 30)) : null }
export function exercisePoints(sessions: WorkoutSession[]): ExercisePoint[] {
  return performanceSessions(sessions).flatMap(session => {
    const grouped = new Map<string, WorkoutSession['exercises'][number]>()
    for (const exercise of session.exercises) {
      const existing = grouped.get(exercise.exerciseId)
      grouped.set(exercise.exerciseId, existing ? { ...existing, sets: [...existing.sets, ...exercise.sets] } : { ...exercise, sets: [...exercise.sets] })
    }
    return [...grouped.values()].map(exercise => {
    const sets = exercise.sets.filter(isWorkingSet)
    const loads = sets.flatMap(s => { const kg = knownKg(s); return kg !== null ? [{ kg, reps: Number(s.reps) }] : [] })
    const estimates = loads.map(s => estimated1Rm(s.kg, s.reps)).filter((n): n is number => n !== null)
    return { date: session.date, sessionId: session.id, exerciseId: exercise.exerciseId, name: exercise.name, weightKg: loads.length ? Math.max(...loads.map(s => s.kg)) : null, estimated1RmKg: estimates.length ? Math.max(...estimates) : null, volumeKg: loads.reduce((sum, s) => sum + s.kg * s.reps, 0), workingSets: sets.length, maxReps: Math.max(0, ...sets.map(s => Number(s.reps))), loads }
  }).filter(p => p.workingSets > 0)
  })
}
export function muscleSets(sessions: WorkoutSession[]) {
  const counts: Record<string, number> = {}
  for (const session of performanceSessions(sessions)) for (const exercise of session.exercises) { const muscle = exercise.muscle?.trim() || 'Unspecified'; counts[muscle] = (counts[muscle] ?? 0) + exercise.sets.filter(isWorkingSet).length }
  return Object.entries(counts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])
}
export function weeklyActivity(sessions: WorkoutSession[], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  const end = new Date(start); end.setDate(end.getDate() + 7)
  return completedSessions(sessions).filter(s => { const [y, m, d] = s.date.split('-').map(Number); const date = new Date(y, m - 1, d); return date >= start && date < end })
}
export function personalRecords(points: ExercisePoint[]) {
  const records = new Map<string, ExercisePoint>()
  for (const point of points) { const old = records.get(point.exerciseId); if (!old || (point.weightKg ?? -1) > (old.weightKg ?? -1)) records.set(point.exerciseId, point) }
  return [...records.values()].filter(p => p.weightKg !== null).sort((a, b) => b.date.localeCompare(a.date))
}
