import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/profiles'

export const exportTables = ['profiles', 'exercises', 'machine_presets', 'exercise_media', 'workout_programmes', 'routine_days', 'routine_exercises', 'workouts', 'workout_exercises', 'workout_sets', 'cardio_sessions', 'body_measurements', 'exercise_performance_references', 'measurement_fields', 'progress_checkins', 'progress_photos', 'weekly_training_targets', 'account_deletion_requests'] as const
export type ExportTable = typeof exportTables[number]
export type ExportRow = Record<string, unknown>
export type PersonalFields = { date_of_birth: string | null; height_cm: number | null; previous_training_months: number | null }
export type TrainingFields = { weekly_target: number; smart_prefill: boolean; circumference_unit: 'cm' | 'in' }
export function personalValues(value: PersonalFields) {
  if (value.date_of_birth !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(value.date_of_birth) || new Date(value.date_of_birth).toISOString().slice(0, 10) !== value.date_of_birth || value.date_of_birth > new Date().toISOString().slice(0, 10))) throw new Error('Enter a valid birth date that is not in the future.')
  if (value.height_cm !== null && (!Number.isFinite(value.height_cm) || value.height_cm <= 0 || value.height_cm > 300)) throw new Error('Height must be positive and at most 300 cm.')
  if (value.previous_training_months !== null && (!Number.isInteger(value.previous_training_months) || value.previous_training_months < 0 || value.previous_training_months > 1200)) throw new Error('Previous training months must be a whole number from 0 to 1200.')
  return { date_of_birth: value.date_of_birth, height_cm: value.height_cm, previous_training_months: value.previous_training_months }
}
export function profileValues(value: Pick<Profile, 'display_name' | 'timezone' | 'weight_unit' | 'distance_unit'>) {
  const display_name = value.display_name?.trim() || null
  if (display_name && display_name.length > 100) throw new Error('Display name must be at most 100 characters.')
  try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format() } catch { throw new Error('Enter a valid timezone, such as America/Chicago.') }
  if (!['kg', 'lb'].includes(value.weight_unit) || !['km', 'mi'].includes(value.distance_unit)) throw new Error('Choose supported measurement units.')
  return { display_name, timezone: value.timezone, weight_unit: value.weight_unit, distance_unit: value.distance_unit }
}
export function csv(rows: ExportRow[]) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
  const cell = (value: unknown) => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (/^[\s]*[=+@-]/.test(text) && typeof value !== 'number') text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  return [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n')
}
export function createSettingsRepository(client: SupabaseClient = supabase) {
  async function account(userId: string) {
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    if (!data.session || data.session.user.id !== userId) throw new Error('A matching signed-in account is required.')
  }
  return {
    async loadTheme(userId: string): Promise<'light' | 'dark' | 'system' | null> {
      await account(userId)
      const { data, error } = await client.from('profiles').select('id,theme').eq('id', userId).single()
      if (error) throw error
      await account(userId)
      if (data?.id !== userId || ![null, 'light', 'dark', 'system'].includes(data.theme)) throw new Error('Your appearance preference could not be verified.')
      return data.theme
    },
    async saveTheme(userId: string, theme: 'light' | 'dark' | 'system') {
      if (!['light', 'dark', 'system'].includes(theme)) throw new Error('Choose a supported theme.')
      await account(userId)
      const { data, error } = await client.from('profiles').update({ theme }).eq('id', userId).select('id').single()
      if (error) throw error
      await account(userId)
      if (data?.id !== userId) throw new Error('Appearance response belongs to another account.')
    },
    async loadPreferences(userId: string) {
      await account(userId)
      const { data, error } = await client.from('profiles').select('id,date_of_birth,height_cm,previous_training_months,weekly_target,smart_prefill,circumference_unit').eq('id', userId).single()
      if (error) throw error
      await account(userId)
      if (data?.id !== userId) throw new Error('Preferences belong to another account.')
      return data as PersonalFields & TrainingFields & { id: string }
    },
    async savePersonalFields(userId: string, values: PersonalFields) {
      await account(userId)
      const { data, error } = await client.from('profiles').update(personalValues(values)).eq('id', userId).select('id').single()
      if (error) throw error
      await account(userId)
      if (data?.id !== userId) throw new Error('Preferences belong to another account.')
    },
    async saveTraining(userId: string, values: TrainingFields) {
      if (!Number.isInteger(values.weekly_target) || values.weekly_target < 0 || values.weekly_target > 14 || typeof values.smart_prefill !== 'boolean' || !['cm', 'in'].includes(values.circumference_unit)) throw new Error('Choose a weekly target from 0 to 14 and supported preferences.')
      await account(userId)
      const { data, error } = await client.from('profiles').update({ weekly_target: values.weekly_target, smart_prefill: values.smart_prefill, circumference_unit: values.circumference_unit }).eq('id', userId).select('id').single()
      if (error) throw error
      await account(userId)
      if (data?.id !== userId) throw new Error('Preferences belong to another account.')
    },
    async saveProfile(userId: string, values: Pick<Profile, 'display_name' | 'timezone' | 'weight_unit' | 'distance_unit'>) {
      await account(userId)
      const { data, error } = await client.from('profiles').update(profileValues(values)).eq('id', userId).select('id,display_name,timezone,weight_unit,distance_unit,created_at,updated_at').single()
      if (error) throw error
      await account(userId)
      if (data?.id !== userId) throw new Error('Profile response belongs to another account.')
      return data as Profile
    },
    async exportRows(userId: string, table: ExportTable): Promise<ExportRow[]> {
      if (!exportTables.includes(table)) throw new Error('Unsupported export dataset.')
      await account(userId)
      const owner = table === 'profiles' ? 'id' : 'user_id', rows: ExportRow[] = []
      const order = table === 'weekly_training_targets' ? 'week_start' : table === 'account_deletion_requests' ? 'user_id' : 'id'
      for (let start = 0; ; start += 500) {
        const { data, error } = await client.from(table).select('*').eq(owner, userId).order(order).range(start, start + 499)
        if (error) throw error
        if ((data ?? []).some(row => row[owner] !== userId)) throw new Error('Export response belongs to another account.')
        rows.push(...(data ?? []))
        if (!data || data.length < 500) break
      }
      await account(userId)
      return rows
    },
  }
}
export const settingsRepository = createSettingsRepository()

// Standards-compliant ZIP with stored entries: no dependency or lossy conversion.
export function zipFiles(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  if (files.length > 65535) throw new Error('This backup has too many files for a standard ZIP.')
  const encoder = new TextEncoder(), pieces: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  const crc = (bytes: Uint8Array) => {
    let value = 0xffffffff
    for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0) }
    return (value ^ 0xffffffff) >>> 0
  }
  for (const file of files) {
    if (!file.name || file.name.startsWith('/') || file.name.includes('..') || file.name.includes('\\')) throw new Error('Unsafe backup filename.')
    const name = encoder.encode(file.name), checksum = crc(file.bytes)
    if (name.length > 65535 || offset + file.bytes.length + 30 + name.length > 0xffffffff) throw new Error('This backup exceeds the standard ZIP size limit.')
    const local = new Uint8Array(30 + name.length), view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true); view.setUint16(12, 33, true)
    view.setUint32(14, checksum, true); view.setUint32(18, file.bytes.length, true); view.setUint32(22, file.bytes.length, true); view.setUint16(26, name.length, true); local.set(name, 30)
    const directory = new Uint8Array(46 + name.length), dv = new DataView(directory.buffer)
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true); dv.setUint16(8, 0x800, true); dv.setUint16(14, 33, true)
    dv.setUint32(16, checksum, true); dv.setUint32(20, file.bytes.length, true); dv.setUint32(24, file.bytes.length, true); dv.setUint16(28, name.length, true); dv.setUint32(42, offset, true); directory.set(name, 46)
    pieces.push(local, file.bytes); central.push(directory); offset += local.length + file.bytes.length
  }
  const centralSize = central.reduce((sum, row) => sum + row.length, 0), end = new Uint8Array(22), dv = new DataView(end.buffer)
  if (offset + centralSize + end.length > 0xffffffff) throw new Error('This backup exceeds the standard ZIP size limit.')
  dv.setUint32(0, 0x06054b50, true); dv.setUint16(8, files.length, true); dv.setUint16(10, files.length, true); dv.setUint32(12, centralSize, true); dv.setUint32(16, offset, true)
  const result = new Uint8Array(offset + centralSize + end.length); let cursor = 0
  for (const piece of [...pieces, ...central, end]) { result.set(piece, cursor); cursor += piece.length }
  return result
}
