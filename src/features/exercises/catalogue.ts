// Names and group labels copied from src/App.tsx DEFAULT_EXERCISES.
// These starter entries are not a licensed, instruction-verified full catalogue.
export type CatalogueExercise = Readonly<{
  catalogueId: string
  name: string
  muscleGroup: string
  equipment?: string
  instructions?: readonly string[]
}>

// Account-owned identities/settings belong in a separate future repository.
// These seed references are not legacy personal IDs or database UUIDs.
export const starterCatalogue: readonly CatalogueExercise[] = Object.freeze([
  { catalogueId: 'starter-barbell-squat', name: 'Barbell Squat', muscleGroup: 'Legs' },
  { catalogueId: 'starter-bench-press', name: 'Bench Press', muscleGroup: 'Chest' },
  { catalogueId: 'starter-deadlift', name: 'Deadlift', muscleGroup: 'Back' },
  { catalogueId: 'starter-overhead-press', name: 'Overhead Press', muscleGroup: 'Shoulders' },
  { catalogueId: 'starter-pull-up', name: 'Pull-up', muscleGroup: 'Back' },
].map(exercise => Object.freeze(exercise)))

export interface CatalogueRepository {
  list(): Promise<readonly CatalogueExercise[]>
}
export const catalogueRepository: CatalogueRepository = {
  async list() { return starterCatalogue },
}

export const UNKNOWN_EQUIPMENT = '__not_recorded__'
export function filterExercises(exercises: readonly CatalogueExercise[], query: string, muscle: string, equipment: string) {
  const search = query.trim().toLocaleLowerCase()
  return exercises.filter(exercise => exercise.name.toLocaleLowerCase().includes(search)
    && (!muscle || exercise.muscleGroup === muscle)
    && (!equipment || (exercise.equipment ?? UNKNOWN_EQUIPMENT) === equipment))
}

export type CatalogueState =
  | { status: 'loading' }
  | { status: 'ready'; exercises: readonly CatalogueExercise[] }
  | { status: 'error' }

// Cleanup cancels delivery to an unmounted screen, including account changes.
export function requestCatalogue(repository: CatalogueRepository, publish: (state: CatalogueState) => void) {
  let active = true
  publish({ status: 'loading' })
  Promise.resolve().then(() => repository.list()).then(
    exercises => { if (active) publish({ status: 'ready', exercises }) },
    () => { if (active) publish({ status: 'error' }) },
  )
  return () => { active = false }
}
