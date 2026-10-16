// One-time catalogue import. Never changes schema, policies, or other tables.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const rows = JSON.parse(readFileSync(new URL('../data/catalogue/free-exercise-db/prepared/catalogue.normalized.json', import.meta.url), 'utf8')).map(row => {
  const { images, ...record } = row.source_metadata.record
  return { id: row.id, name: row.name, primary_muscle: row.primary_muscle,
    equipment: row.equipment, instructions: row.instructions,
    source_provider: row.source_provider, source_id: row.source_id,
    source_revision: row.source_revision, source_metadata: { record, image_references: [] } }
})
if (rows.length !== 876 || new Set(rows.map(row => row.id)).size !== 876 ||
    rows.some(row => row.id !== `free-exercise-db:${row.source_id}`)) {
  throw new Error('Expected exactly 876 unique prepared catalogue IDs.')
}
if (process.argv.includes('--validate')) {
  console.log('Validated 876 unique exercises; image fields excluded; batches of 50; conflict key id.')
  process.exit(0)
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  // Server-only admin credential: never use a VITE_ variable for this key.
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Configure SUPABASE_URL and SUPABASE_SECRET_KEY in a gitignored .env.import.local file or local process environment.')
  if (new URL(url).hostname !== 'bqzqiidniitbraapjmyk.supabase.co') throw new Error('Project URL mismatch.')
  if (!key.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY must be a Supabase secret API key.')
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const table = () => client.schema('public').from('exercise_catalogue')
  const check = (result, operation) => {
    if (result.error) throw new Error(`${operation} failed: HTTP ${result.status}, code ${result.error.code || 'unknown'}. Stopped without retry.`)
    return result
  }
  const count = async () => {
    const result = check(await table().select('id', { count: 'exact' }).limit(1), 'Count')
    if (!Number.isInteger(result.count)) throw new Error('Exact catalogue count unavailable.')
    return result.count
  }
  const before = await count()
  console.log(`Initial visible catalogue count: ${before}`)
  // Check source identity before overwriting any existing IDs.
  let existing = 0
  for (let offset = 0; offset < rows.length; offset += 50) {
    const batch = rows.slice(offset, offset + 50)
    const result = check(await table().select('id,source_provider,source_id').in('id', batch.map(row => row.id)), 'Identity check')
    for (const row of result.data) {
      if (row.source_provider !== 'free-exercise-db' || row.id !== `free-exercise-db:${row.source_id}`) throw new Error('Catalogue identity collision; no writes made.')
    }
    existing += result.data.length
  }
  let completed = 0
  for (let offset = 0; offset < rows.length; offset += 50) {
    const batch = rows.slice(offset, offset + 50)
    check(await table().upsert(batch, { onConflict: 'id' }), 'Upsert')
    completed += batch.length
    console.log(`Upserted ${completed}/876`)
  }
  let verified = 0
  for (let offset = 0; offset < rows.length; offset += 50) {
    const batch = rows.slice(offset, offset + 50)
    const result = check(await table().select('id').in('id', batch.map(row => row.id)), 'Verification')
    if (result.data.length !== batch.length) throw new Error('Imported IDs verification failed.')
    verified += result.data.length
  }
  const final = await count()
  if (final !== before + rows.length - existing) throw new Error(`Final visible count ${final} differs from expected ${before + rows.length - existing}; concurrent changes or restricted visibility may apply.`)
  console.log(`Verified ${verified} imported IDs. Final catalogue count visible to this credential: ${final}`)
}
main().catch(error => {
  // Never emit raw client/network errors, which might contain request credentials.
  const message = String(error.message).replace(/sb_secret_[A-Za-z0-9_-]+/g, '[REDACTED]')
  console.error(message)
  process.exitCode = 1
})
