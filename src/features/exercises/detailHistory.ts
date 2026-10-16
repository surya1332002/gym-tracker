import type { WorkoutSession } from '../workout/sessions'
import { exercisePoints } from '../progress/analytics'
import type { ExercisePoint } from '../progress/analytics'
export function filterExerciseSessions(sessions: WorkoutSession[], exerciseId: string, routine: string, from: string, to: string) {
  return sessions.filter(session => session.exercises.some(exercise => exercise.exerciseId === exerciseId) && (!routine || session.name === routine) && (!from || session.date >= from) && (!to || session.date <= to))
}
export function exerciseHistoryPoints(sessions: WorkoutSession[], exerciseId: string): ExercisePoint[] {
  const grouped = new Map<string, ExercisePoint>()
  for (const point of exercisePoints(sessions).filter(value => value.exerciseId === exerciseId)) {
    const previous = grouped.get(point.sessionId)
    if (!previous) grouped.set(point.sessionId, { ...point, loads: [...point.loads] })
    else { const weights = [previous.weightKg, point.weightKg].filter((value): value is number => value !== null), estimates = [previous.estimated1RmKg, point.estimated1RmKg].filter((value): value is number => value !== null); grouped.set(point.sessionId, { ...previous, weightKg: weights.length ? Math.max(...weights) : null, estimated1RmKg: estimates.length ? Math.max(...estimates) : null, volumeKg: previous.volumeKg + point.volumeKg, workingSets: previous.workingSets + point.workingSets, maxReps: Math.max(previous.maxReps, point.maxReps), loads: [...previous.loads, ...point.loads] }) }
  }
  return [...grouped.values()]
}
export function exerciseHistoryPrs(points: ExercisePoint[]) {
  const weights = points.map(point => point.weightKg).filter((value): value is number => value !== null), estimates = points.map(point => point.estimated1RmKg).filter((value): value is number => value !== null), heaviestKg = weights.length ? Math.max(...weights) : null
  const repsAtTopLoad = heaviestKg !== null ? Math.max(...points.flatMap(point => point.loads).filter(load => Math.abs(load.kg - heaviestKg) < 0.0000001).map(load => load.reps)) : null
  return { heaviestKg, estimated1RmKg: estimates.length ? Math.max(...estimates) : null, bestSessionVolumeKg: weights.length ? Math.max(...points.map(point => point.volumeKg)) : null, repsAtTopLoad, workingSets: points.reduce((total, point) => total + point.workingSets, 0) }
}
