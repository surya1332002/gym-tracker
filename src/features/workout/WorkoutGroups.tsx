import type { ReactNode } from 'react'
import type { SessionExercise } from './sessions'
import { newSet } from './sessions'
export type WorkoutBlock = { key: string; group: SessionExercise['group']; indices: number[] }
export function workoutBlocks(exercises: SessionExercise[]): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = [], groups = new Map<string, WorkoutBlock>()
  exercises.forEach((exercise, index) => { if (!exercise.group?.id) { blocks.push({ key: exercise.id, group: undefined, indices: [index] }); return } const existing = groups.get(exercise.group.id); if (existing) existing.indices.push(index); else { const block = { key: `group:${exercise.group.id}`, group: exercise.group, indices: [index] }; groups.set(exercise.group.id, block); blocks.push(block) } })
  return blocks
}
export function groupRounds(exercises: SessionExercise[], indices: number[]) { const rounds = [...new Set(indices.flatMap(index => exercises[index]?.sets.map(set => set.number) ?? []))].sort((a, b) => a - b); return rounds.map(round => ({ round, completed: indices.filter(index => exercises[index]?.sets.find(set => set.number === round)?.completed).length, total: indices.length })) }
export function addWorkoutRound(exercises: SessionExercise[], groupId: string): SessionExercise[] {
  const selected = exercises.filter(exercise => exercise.group?.id === groupId)
  if (!selected.length) throw new Error('Workout group is unavailable.')
  const next = Math.max(1, ...selected.map(exercise => exercise.nextNumber), ...selected.flatMap(exercise => exercise.sets.map(set => set.number + 1)))
  if (next > 100 || selected.some(exercise => exercise.sets.length >= 100)) throw new Error('Each exercise supports at most 100 sets.')
  return exercises.map(exercise => exercise.group?.id !== groupId ? exercise : { ...exercise, nextNumber: next + 1, sets: [...exercise.sets, newSet(next)] })
}
export default function WorkoutGroups({ exercises, readOnly, renderExercise, onChange, focusedIndex }: { exercises: SessionExercise[]; readOnly: boolean; renderExercise: (index: number) => ReactNode; onChange: (exercises: SessionExercise[]) => void; focusedIndex?: number }) {
  return <>{workoutBlocks(exercises).map(block => !block.group ? <div key={block.key}>{renderExercise(block.indices[0])}</div> : <details className="planner-card workout-group" key={block.key} open={focusedIndex !== undefined && block.indices.includes(focusedIndex) ? true : undefined}><summary style={{ minHeight: 44, cursor: 'pointer' }}><strong>{block.group.name || block.group.type}</strong><span> · {block.indices.length} exercises</span></summary><div aria-label={`${block.group.name} rounds`}>{groupRounds(exercises, block.indices).map(round => <p key={round.round}>Round {round.round}: {round.completed}/{round.total} sets completed</p>)}</div>{block.indices.map(index => <div key={exercises[index].id}>{renderExercise(index)}</div>)}<button type="button" className="reset-filters" disabled={readOnly || block.indices.some(index => exercises[index].sets.length >= 100 || exercises[index].nextNumber > 100 || exercises[index].sets.some(set => set.number >= 100))} onClick={() => onChange(addWorkoutRound(exercises, block.group!.id))}>Add blank round</button></details>)}</>
}
