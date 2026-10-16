export const splits = ['PPL', 'Upper/Lower', 'Single muscle', 'Two muscles', 'Three muscles', 'Full Body', 'Custom'] as const
export type Split = typeof splits[number]
export type PlannedExercise = { exerciseId: string; name: string; sets: number | null; startingWeightLb?: string; repsInput?: string; perSetReps?: (number|null)[]; group?: {id:string;type:'superset'|'triset'|'circuit';name:string}; min: number | null; max: number | null }
export type DraftDay = { name: string; exercises: PlannedExercise[] }
export type WorkoutDraft = { name?: string; muscles?: string[]; split: Split; days: DraftDay[] }
export const routineBoundary = 'Programme saving is unavailable until the proposed catalogue/programme migration and online save contract are approved, isolated-tested and deployed. Existing routine days remain unchanged. This draft is not saved.'
export function dayNames(split: Split, count: number, muscles: string[] = []) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Preview day count must be between 1 and 100.')
  const base = split === 'PPL' ? ['Push', 'Pull', 'Legs'] : split === 'Upper/Lower' ? ['Upper', 'Lower'] : split === 'Full Body' ? ['Full Body'] : split === 'Custom' ? ['Day'] : [muscles.filter(Boolean).join(' / ') || split]
  return Array.from({ length: count }, (_, index) => `${base[index % base.length]} ${split === 'Custom' ? index + 1 : cycleLabel(Math.floor(index / base.length))}`)
}
function cycleLabel(index: number): string { return index < 26 ? String.fromCharCode(65 + index) : `${cycleLabel(Math.floor(index / 26) - 1)}${String.fromCharCode(65 + index % 26)}` }
export function moveExercise<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items
  const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next
}
export function validatePlan(exercise: PlannedExercise) {
  if(exercise.perSetReps && (exercise.perSetReps.length>20 || exercise.perSetReps.some(n=>n!==null&&(!Number.isInteger(n)||n<1||n>1000))))return 'Per-set reps must be 1?1000 or blank.'
  if(exercise.group && (!exercise.group.id || !['superset','triset','circuit'].includes(exercise.group.type)))return 'Choose a valid exercise group.'
  if (exercise.repsInput?.trim() && !/^(\d+)(?:\s*[-\u2013]\s*(\d+))?$/.test(exercise.repsInput.trim())) return 'Use a rep count or range such as 8-12.'
  if (exercise.startingWeightLb?.trim() && (!Number.isFinite(Number(exercise.startingWeightLb)) || Number(exercise.startingWeightLb) < 0)) return 'Starting weight must be a non-negative number in lb.'
  if (exercise.sets !== null && (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20)) return 'Planned sets must be 1–20.'
  if ((exercise.min === null) !== (exercise.max === null)) return 'Enter both rep bounds, or leave both blank.'
  if ([exercise.min, exercise.max].some(value => value !== null && (!Number.isInteger(value) || value < 1 || value > 1000))) return 'Rep bounds must be whole numbers from 1–1000.'
  if (exercise.min !== null && exercise.max !== null && exercise.min > exercise.max) return 'Minimum reps must not exceed maximum reps.'
  return ''
}
