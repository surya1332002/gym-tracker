import type { ExercisePoint } from './analytics'
export default function TrainingInsights({ points, exerciseId }: { points: ExercisePoint[]; exerciseId?: string }) {
  const selected = points.filter(p => p.exerciseId === exerciseId && p.weightKg !== null), first = selected[0], last = selected.at(-1)
  return <section className="analytics-card"><h2>Training insights</h2>{first && last && first !== last ? <><p>Recorded top weight changed by {((last.weightKg! - first.weightKg!) / 0.45359237).toFixed(1)} lb between {first.date} and {last.date} for {last.name}.</p><p>Based on {selected.length} recorded exercise sessions. Different reps, effort and settings can affect this comparison.</p></> : <p>Record at least two completed sessions with known weights for the selected exercise to compare your progress.</p>}<small>These insights are calculated from your records. No AI request runs automatically.</small></section>
}
