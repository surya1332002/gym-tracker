import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { photoBucket, photoPath, validatePhoto } from '../photos/photos'
export type ExerciseMediaRecord = { id: string; user_id: string; exercise_id: string; preset_id: string | null; object_path: string; label: string; original_name: string; mime_type: string; size_bytes: number; archived_at: string | null }
export function exercisePhotoPath(userId: string, id: string, type: string) { return photoPath(userId, `exercise-${id}`, type) }
export function createExerciseMediaRepository(client: SupabaseClient = supabase) {
  async function account(userId: string) { const { data, error } = await client.auth.getSession(); if (error) throw error; if (!userId || data.session?.user.id !== userId) throw new Error('A matching signed-in account is required.') }
  function owned(row: ExerciseMediaRecord, userId: string) { if (!row || row.user_id !== userId || row.object_path !== exercisePhotoPath(userId, row.id, row.mime_type)) throw new Error('Exercise photo belongs to another account or invalid object identity.'); return row }
  async function existing(userId: string, id: string) { const { data, error } = await client.from('exercise_media').select('*').eq('user_id', userId).eq('id', id).maybeSingle(); if (error) throw error; return data ? owned(data as ExerciseMediaRecord, userId) : null }
  async function compareOriginal(path: string, file: File) { const { data, error } = await client.storage.from(photoBucket).download(path); if (error) throw error; const [a, b] = await Promise.all([data.arrayBuffer(), file.arrayBuffer()]), original = new Uint8Array(a), next = new Uint8Array(b); if (original.length !== next.length || original.some((value, index) => value !== next[index])) throw new Error('An original photo already uses this identity and differs. It was preserved.') }
  return {
    async list(userId: string, exerciseId: string, presetId: string | null = null, includeArchived = false): Promise<ExerciseMediaRecord[]> { await account(userId); let query = client.from('exercise_media').select('*').eq('user_id', userId).eq('exercise_id', exerciseId); query = presetId === null ? query.is('preset_id', null) : query.eq('preset_id', presetId); if (!includeArchived) query = query.is('archived_at', null); const { data, error } = await query.order('created_at'); if (error) throw error; await account(userId); return (data ?? []).map(row => { const value = owned(row as ExerciseMediaRecord, userId); if (value.exercise_id !== exerciseId || value.preset_id !== presetId) throw new Error('Exercise photo belongs to another exercise or preset.'); return value }) },
    async upload(userId: string, exerciseId: string, presetId: string | null, id: string, label: string, file: File) {
      await account(userId); await validatePhoto(file)
      const path = exercisePhotoPath(userId, id, file.type), found = await existing(userId, id)
      if (found) { if (found.exercise_id !== exerciseId || found.preset_id !== presetId || found.object_path !== path || found.mime_type !== file.type || found.size_bytes !== file.size) throw new Error('This photo identity already belongs to different original data.'); await compareOriginal(path, file); await account(userId); return found }
      const bucket = client.storage.from(photoBucket), uploaded = await bucket.upload(path, file, { contentType: file.type, upsert: false })
      if (uploaded.error) { if (String(uploaded.error.statusCode) !== '409' && !/already exists|duplicate/i.test(uploaded.error.message)) throw uploaded.error; await compareOriginal(path, file) }
      await account(userId)
      const row: ExerciseMediaRecord = { id, user_id: userId, exercise_id: exerciseId, preset_id: presetId, object_path: path, label: label.trim(), original_name: file.name, mime_type: file.type, size_bytes: file.size, archived_at: null }
      const { data, error } = await client.from('exercise_media').insert(row).select('*').single()
      if (error) { const retry = await existing(userId, id); if (!retry || retry.exercise_id !== exerciseId || retry.preset_id !== presetId || retry.object_path !== path) throw error; await account(userId); return retry }
      await account(userId); return owned(data as ExerciseMediaRecord, userId)
    },
    async update(userId: string, row: ExerciseMediaRecord, changes: { label?: string; archived_at?: string | null }) { owned(row, userId); await account(userId); const values = { ...(changes.label !== undefined ? { label: changes.label.trim() } : {}), ...(changes.archived_at !== undefined ? { archived_at: changes.archived_at } : {}) }; const { data, error } = await client.from('exercise_media').update(values).eq('user_id', userId).eq('id', row.id).select('*').single(); if (error) throw error; await account(userId); return owned(data as ExerciseMediaRecord, userId) },
    async signedUrl(userId: string, row: ExerciseMediaRecord) { owned(row, userId); await account(userId); const { data, error } = await client.storage.from(photoBucket).createSignedUrl(row.object_path, 600); if (error) throw error; await account(userId); return data.signedUrl },
    async original(userId: string, row: ExerciseMediaRecord) { owned(row, userId); await account(userId); const { data, error } = await client.storage.from(photoBucket).download(row.object_path); if (error) throw error; await account(userId); return data },
  }
}
export const exerciseMediaRepository = createExerciseMediaRepository()
