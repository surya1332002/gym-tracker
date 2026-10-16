import { supabase } from '../../lib/supabase'
import { matchesMuscle } from './muscleGroups'
import { catalogueImages } from './catalogueMedia'
import type { ApprovedCatalogueImage } from './catalogueMedia'
// Names and group labels copied from src/App.tsx DEFAULT_EXERCISES.
// These starter entries are not a licensed, instruction-verified full catalogue.
export type CatalogueExercise = Readonly<{
  catalogueId: string
  name: string
  muscleGroup: string
  equipment?: string
  instructions?: readonly string[]
  primaryMuscles?: readonly string[]
  secondaryMuscles?: readonly string[]
  category?: string
  level?: string
  images?: readonly ApprovedCatalogueImage[]
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
// Read shared data from Supabase only. No fallback seeds or image URLs are served.
export function createCatalogueRepository(client: Pick<typeof supabase, 'from'>): CatalogueRepository {
  return { async list() {
    const rows: CatalogueExercise[] = []
    const pageSize = 250
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.from('exercise_catalogue')
        .select('id,name,primary_muscle,primary_muscles,secondary_muscles,equipment,instruction_steps,category,level,image_references')
        .order('id').range(offset, offset + pageSize - 1)
      if (error) throw error
      for (const row of data ?? []) {
        if (typeof row.id !== 'string' || typeof row.name !== 'string'
          || !Array.isArray(row.primary_muscles) || !Array.isArray(row.secondary_muscles)
          || !Array.isArray(row.instruction_steps)
          || [...row.primary_muscles, ...row.secondary_muscles, ...row.instruction_steps].some(value => typeof value !== 'string')) {
          throw new Error('Catalogue metadata is incomplete. Check the migration and import.')
        }
        rows.push({ catalogueId: row.id, name: row.name, muscleGroup: row.primary_muscle ?? 'Multiple / not recorded',
          primaryMuscles: row.primary_muscles, secondaryMuscles: row.secondary_muscles,
          equipment: row.equipment ?? undefined, instructions: row.instruction_steps,
          category: row.category, level: row.level, images: catalogueImages(row.id, row.image_references) })
      }
      if ((data ?? []).length < pageSize) break
    }
    if (new Set(rows.map(row => row.catalogueId)).size !== rows.length) throw new Error('Duplicate catalogue identities returned.')
    return rows
  } }
}
export const catalogueRepository = createCatalogueRepository(supabase)

export const UNKNOWN_EQUIPMENT = '__not_recorded__'
export function filterExercises(exercises: readonly CatalogueExercise[], query: string, muscle: string, equipment: string) {
  const search = query.trim().toLocaleLowerCase()
  return exercises.filter(exercise => exercise.name.toLocaleLowerCase().includes(search)
    && matchesMuscle(exercise, muscle)
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
