import { supabase } from '../../lib/supabase'
import { createUuid } from '../../lib/uuid'
export type MachinePreset = { id: string; user_id: string; exercise_id: string; label: string; machine_name: string | null; seat_position: string | null; backrest_position: string | null; handle_or_grip: string | null; bench_angle: string | null; other_settings: Record<string, string>; notes: string | null }
export type PresetInput = { label: string; machine_name: string; seat_position: string; backrest_position: string; handle_or_grip: string; bench_angle: string; other_settings: Record<string, string>; notes: string }
export type ExercisePreferences = { id: string; user_id: string; notes: string | null; weight_unit: 'lb' | 'kg' | null; weight_increment: number | null; is_favourite: boolean; tutorial_url: string | null; last_used_at: string | null; weight_preferences_configured?: boolean }
export function safeTutorialUrl(value: string): string | null {
  if (!value.trim()) return null
  try { const url = new URL(value.trim()); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(); return url.href } catch { throw new Error('Tutorial link must be a complete HTTP or HTTPS URL without credentials.') }
}
export function presetValues(input: PresetInput) {
  if (!input.label.trim()) throw new Error('Give this preset a name.')
  if (!input.other_settings || Array.isArray(input.other_settings) || typeof input.other_settings !== 'object' || Object.entries(input.other_settings).some(([key, value]) => !key.trim() || typeof value !== 'string')) throw new Error('Custom settings need names and text values.')
  const nullable = (value: string) => value.trim() || null
  return { label: input.label.trim(), machine_name: nullable(input.machine_name), seat_position: nullable(input.seat_position), backrest_position: nullable(input.backrest_position), handle_or_grip: nullable(input.handle_or_grip), bench_angle: nullable(input.bench_angle), notes: nullable(input.notes), other_settings: input.other_settings }
}
export function preferenceValues(input: { notes: string; weight_unit: 'lb' | 'kg'; weight_increment: string; is_favourite: boolean; tutorial_url: string }) {
  if (!['lb', 'kg'].includes(input.weight_unit)) throw new Error('Choose lb or kg.')
  const increment = input.weight_increment.trim() ? Number(input.weight_increment) : null
  if (increment !== null && (!Number.isFinite(increment) || increment <= 0)) throw new Error('Weight increment must be positive or blank.')
  return { weight_preferences_configured: true, notes: input.notes.trim() || null, weight_unit: input.weight_unit, weight_increment: increment, is_favourite: input.is_favourite, tutorial_url: safeTutorialUrl(input.tutorial_url), updated_at: new Date().toISOString() }
}
export function createMachinePresetRepository(client: Pick<typeof supabase, 'auth' | 'from'>) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw error; if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  function owned<T extends { user_id: string }>(row: T, userId: string) { if (!row || row.user_id !== userId) throw new Error('Settings response belongs to another account.'); return row }
  return {
    async list(userId: string, exerciseId: string): Promise<MachinePreset[]> { await account(userId); const { data, error } = await client.from('machine_presets').select('*').eq('user_id', userId).eq('exercise_id', exerciseId).order('label'); if (error) throw error; await account(userId); return (data ?? []).map(row => { owned(row, userId); if (row.exercise_id !== exerciseId) throw new Error('Preset belongs to another exercise.'); return row as MachinePreset }) },
    async save(userId: string, exerciseId: string, input: PresetInput, id = createUuid()): Promise<MachinePreset> { const values = presetValues(input); await account(userId); const existing = await this.list(userId, exerciseId); const current = existing.find(row => row.id === id); const query = current ? client.from('machine_presets').update({ ...values, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('exercise_id', exerciseId).eq('id', id) : client.from('machine_presets').insert({ ...values, id, user_id: userId, exercise_id: exerciseId }); const { data, error } = await query.select('*').single(); if (error) throw error; await account(userId); return owned(data as MachinePreset, userId) },
    async remove(userId: string, exerciseId: string, id: string) { await account(userId); const { data, error } = await client.from('machine_presets').delete().eq('id', id).eq('exercise_id', exerciseId).eq('user_id', userId).select('id,user_id'); if (error) throw error; await account(userId); if (data?.length !== 1 || data[0].id !== id) throw new Error('Preset deletion was not confirmed.'); owned(data[0], userId) },
    async preferences(userId: string, exerciseId: string): Promise<ExercisePreferences> { await account(userId); const { data, error } = await client.from('exercises').select('id,user_id,notes,weight_unit,weight_increment,is_favourite,tutorial_url,last_used_at,weight_preferences_configured').eq('user_id', userId).eq('id', exerciseId).single(); if (error) throw error; await account(userId); return owned(data as ExercisePreferences, userId) },
    async savePreferences(userId: string, exerciseId: string, input: Parameters<typeof preferenceValues>[0]) { const values = preferenceValues(input); await account(userId); const { data, error } = await client.from('exercises').update(values).eq('user_id', userId).eq('id', exerciseId).select('id,user_id,notes,weight_unit,weight_increment,is_favourite,tutorial_url,last_used_at,weight_preferences_configured').single(); if (error) throw error; await account(userId); return owned(data as ExercisePreferences, userId) },
  }
}
export const machinePresetRepository = createMachinePresetRepository(supabase)
