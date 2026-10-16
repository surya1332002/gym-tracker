import { supabase } from '../../lib/supabase'
import { safeTutorialUrl } from './machinePresets'

export type ExerciseInput = {
  name: string; primary_muscle: string; equipment: string; instructions: string; notes: string
  weight_unit: 'kg' | 'lb'; weight_increment: string; tutorial_url?: string
}
export type PersonalExercise = {
  catalogue_id?: string | null
  last_machine_preset_id?: string | null
  is_favourite?: boolean
  last_used_at?: string | null
  tutorial_url?: string | null
  weight_preferences_configured?: boolean
  id: string; user_id: string; name: string; primary_muscle: string | null
  equipment: string | null; instructions: string | null; notes: string | null
  weight_unit: 'kg' | 'lb' | null; weight_increment: number | null; is_archived: boolean
}
const columns = 'id,user_id,catalogue_id,name,primary_muscle,equipment,instructions,notes,weight_unit,weight_increment,is_archived,last_machine_preset_id,weight_preferences_configured,is_favourite,last_used_at,tutorial_url'
export function filterPersonalExercises(rows: PersonalExercise[], query: string, muscle: string, equipment: string, showArchived: boolean) {
  return rows.filter(row => (showArchived || !row.is_archived)
    && row.name.toLowerCase().includes(query.trim().toLowerCase())
    && (!muscle || (row.primary_muscle ?? 'Not recorded') === muscle)
    && (!equipment || (row.equipment ?? '__not_recorded__') === equipment))
}
export function validateInput(input: ExerciseInput) {
  if (!input.name.trim() || !input.primary_muscle.trim() || !input.equipment.trim()) throw new Error('Name, primary muscle and equipment are required.')
  if (!['kg', 'lb'].includes(input.weight_unit)) throw new Error('Choose kg or lb.')
  const increment = input.weight_increment.trim() ? Number(input.weight_increment) : null
  if (increment !== null && (!Number.isFinite(increment) || increment <= 0)) throw new Error('Weight increment must be a positive finite number, or blank.')
  return { name: input.name.trim(), primary_muscle: input.primary_muscle.trim(), equipment: input.equipment.trim(), instructions: input.instructions.trim() || null, notes: input.notes.trim() || null, weight_unit: input.weight_unit, weight_increment: increment, ...(input.tutorial_url === undefined ? {} : { tutorial_url: safeTutorialUrl(input.tutorial_url) }) }
}
async function requireAccount(userId: string) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!userId || session?.user.id !== userId) throw new Error('A matching signed-in account is required.')
}
function owned(row: PersonalExercise, userId: string) {
  if (!row || row.user_id !== userId) throw new Error('The exercise response does not belong to this account.')
  return row
}
export async function listPersonalExercises(userId: string): Promise<PersonalExercise[]> {
  await requireAccount(userId)
  const { data, error } = await supabase.from('exercises').select(columns).eq('user_id', userId).order('name')
  if (error) throw error
  await requireAccount(userId)
  return (data ?? []).map(row => owned(row as PersonalExercise, userId))
}
export async function savePersonalExercise(userId: string, input: ExerciseInput, id?: string): Promise<PersonalExercise> {
  const values = validateInput(input)
  await requireAccount(userId)
  const query = id
    ? supabase.from('exercises').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    : supabase.from('exercises').insert({ ...values, user_id: userId })
  const { data, error } = await query.select(columns).single()
  if (error) throw error
  await requireAccount(userId)
  return owned(data as PersonalExercise, userId)
}
export async function archivePersonalExercise(userId: string, id: string): Promise<PersonalExercise> {
  await requireAccount(userId)
  const { data, error } = await supabase.from('exercises').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select(columns).single()
  if (error) throw error
  await requireAccount(userId)
  return owned(data as PersonalExercise, userId)
}
