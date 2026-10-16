import type { CatalogueExercise } from './catalogue'

// Shared by browsing and filtering; a future muscle map can use the same IDs.
export const muscleGroups = [
  { id: 'chest', name: 'Chest', muscles: ['chest'] },
  { id: 'back', name: 'Back', muscles: ['lats', 'middle back', 'lower back', 'back'] },
  { id: 'shoulders', name: 'Shoulders', muscles: ['shoulders'] },
  { id: 'biceps', name: 'Biceps', muscles: ['biceps'] },
  { id: 'triceps', name: 'Triceps', muscles: ['triceps'] },
  { id: 'forearms', name: 'Forearms', muscles: ['forearms'] },
  { id: 'abs-core', name: 'Abs/Core', muscles: ['abdominals', 'abs', 'core'] },
  { id: 'glutes', name: 'Glutes', muscles: ['glutes'] },
  { id: 'quads', name: 'Quads', muscles: ['quadriceps', 'quads'] },
  { id: 'hamstrings', name: 'Hamstrings', muscles: ['hamstrings'] },
  { id: 'calves', name: 'Calves', muscles: ['calves'] },
  { id: 'traps', name: 'Traps', muscles: ['traps'] },
  { id: 'neck', name: 'Neck', muscles: ['neck'] },
  { id: 'adductors', name: 'Adductors', muscles: ['adductors'] },
  { id: 'abductors', name: 'Abductors', muscles: ['abductors'] },
] as const

export function matchesMuscle(exercise: CatalogueExercise, group: string): boolean {
  if (!group) return true
  const normalized = group.toLowerCase()
  const category = muscleGroups.find(item => item.id === normalized || item.name.toLowerCase() === normalized)
  const targets = category ? [...category.muscles] as string[] : [normalized]
  // Use all recorded primary targets; secondary targets never inflate categories.
  const recorded = exercise.primaryMuscles?.length ? exercise.primaryMuscles : [exercise.muscleGroup]
  return recorded.some(muscle => targets.includes(muscle.toLowerCase()))
}

export function catalogueResultsVisible(query: string, muscle: string, browse: string): boolean {
  return !!(query.trim() || muscle || browse === 'all')
}
