import { exportTables, zipFiles, type ExportTable, type ExportRow } from './settings'
import type { ProgressPhoto } from '../photos/photos'

export type BackupSources = {
  readRows: (userId: string, table: ExportTable) => Promise<ExportRow[]>
  original: (userId: string, photo: ProgressPhoto) => Promise<Blob>
  profileOriginal?: (userId: string, path: string) => Promise<Blob>
  privateObjects?: (userId: string) => Promise<string[]>
  localWorkouts: (userId: string) => Promise<{ userId: string; session: unknown }[]>
}
export async function buildBackup(userId: string, sources: BackupSources, settings: { theme: string }, now = new Date()) {
  const encoder = new TextEncoder(), files: { name: string; bytes: Uint8Array }[] = []
  let photos: ProgressPhoto[] = []
  let profilePath: string | null = null
  for (const table of exportTables) {
    const rows = await sources.readRows(userId, table)
    if (rows.some(row => row[table === 'profiles' ? 'id' : 'user_id'] !== userId)) throw new Error('Backup data belongs to another account.')
    files.push({ name: `data/${table}.json`, bytes: encoder.encode(JSON.stringify(rows, null, 2)) })
    if (table === 'progress_photos') photos = rows as unknown as ProgressPhoto[]
    if (table === 'profiles') profilePath = typeof rows[0]?.profile_photo_path === 'string' ? rows[0].profile_photo_path : null
  }
  const photoFiles: { id: string; filename: string; original_name: string }[] = []
  const backedPaths = new Set<string>()
  for (const photo of photos) {
    if (!/^[-a-zA-Z0-9]+$/.test(photo.id) || !photo.object_path.startsWith(`${userId}/`) || photo.object_path.includes('..')) throw new Error('Unsafe original photo reference.')
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[photo.mime_type]
    if (!extension) throw new Error('Unsupported original photo format in backup.')
    const blob = await sources.original(userId, photo)
    if (blob.size !== Number(photo.size_bytes)) throw new Error('An original photo is incomplete. The backup was not downloaded.')
    const filename = `photos/${photo.id}.${extension}`
    files.push({ name: filename, bytes: new Uint8Array(await blob.arrayBuffer()) })
    photoFiles.push({ id: photo.id, filename, original_name: photo.original_name })
    backedPaths.add(photo.object_path)
  }
  const local = await sources.localWorkouts(userId)
  let profileFilename: string | null = null
  if (profilePath) {
    if (!profilePath.startsWith(`${userId}/`) || profilePath.includes('..') || !sources.profileOriginal) throw new Error('The private profile photo could not be included in this backup.')
    const blob = await sources.profileOriginal(userId, profilePath)
    const extension = profilePath.match(/\.(jpg|png|webp)$/i)?.[1]?.toLowerCase()
    if (!extension || !blob.size) throw new Error('The private profile photo is incomplete. The backup was not downloaded.')
    profileFilename = `photos/profile-original.${extension}`
    files.push({ name: profileFilename, bytes: new Uint8Array(await blob.arrayBuffer()) })
    backedPaths.add(profilePath)
  }
  const extraOriginals: { object_path: string; filename: string }[] = []
  if (sources.privateObjects && sources.profileOriginal) {
    for (const path of await sources.privateObjects(userId)) {
      if (!path.startsWith(`${userId}/`) || path.includes('..')) throw new Error('Private storage belongs to another account.')
      if (backedPaths.has(path)) continue
      const blob = await sources.profileOriginal(userId, path)
      const filename = `private-originals/${path.slice(userId.length + 1)}`
      files.push({ name: filename, bytes: new Uint8Array(await blob.arrayBuffer()) })
      extraOriginals.push({ object_path: path, filename })
      backedPaths.add(path)
    }
  }
  if (local.some(row => row.userId !== userId)) throw new Error('Local workout data belongs to another account.')
  files.push({ name: 'device/workouts.json', bytes: encoder.encode(JSON.stringify(local, null, 2)) }, { name: 'settings.json', bytes: encoder.encode(JSON.stringify(settings, null, 2)) }, { name: 'manifest.json', bytes: encoder.encode(JSON.stringify({ format: 'arc-fit-backup', version: 2, exported_at: now.toISOString(), datasets: exportTables, original_photos: photoFiles, profile_photo: profileFilename, additional_private_originals: extraOriginals, includes_archived_records: true, includes_local_workout_copies: true, restoration_supported: false }, null, 2)) })
  // Revalidate account after the final local/media reads before releasing the archive.
  const finalProfiles = await sources.readRows(userId, 'profiles')
  if (finalProfiles.some(row => row.id !== userId)) throw new Error('The signed-in account changed before backup completion.')
  return zipFiles(files)
}
