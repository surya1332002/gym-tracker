// Offline preparation only: no network, credentials, database client or execution.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const provider = 'free-exercise-db'
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const text = value => typeof value === 'string' && value.trim().length > 0 && !value.includes('\0')
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && !item.includes('\0'))
const hasNul = value => typeof value === 'string' ? value.includes('\0') : value && typeof value === 'object' ? Object.entries(value).some(([key, item]) => key.includes('\0') || hasNul(item)) : false
const group = (values, key) => {
  const groups = new Map()
  for (const value of values) { const name = key(value); groups.set(name, [...(groups.get(name) ?? []), value]) }
  return [...groups].filter(([, rows]) => rows.length > 1)
}
export const sqlText = value => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`

export function prepareCatalogue(records, { revision, schema, imageIndex }) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('A pinned 40-character source commit is required.')
  if (!Array.isArray(records)) throw new Error('Source dataset must be an array.')
  if (!Array.isArray(imageIndex) || !schema?.properties) throw new Error('Source schema and complete image index required.')
  const files = new Map(imageIndex.map(file => [file.path, file]))
  const errors = [], issues = [], rows = []
  const note = (id, field, reason) => issues.push({ id, field, reason })
  for (const [index, record] of records.entries()) {
    const id = record?.id ?? `row:${index}`
    const errorCount = errors.length
    if (!record || typeof record !== 'object' || Array.isArray(record)) { errors.push({ id, reason: 'Expected object' }); continue }
    if (!text(record.id) || !/^[0-9a-zA-Z_-]+$/.test(record.id)) errors.push({ id, reason: 'Invalid stable source ID' })
    if (!text(record.name)) errors.push({ id, reason: 'Missing/invalid name' })
    // Validate all enum fields, including every muscle (upstream tuple-style
    // schema does not by itself validate all subsequent array elements).
    for (const field of ['level', 'category', 'force', 'mechanic', 'equipment']) {
      const value = record[field]
      if (value === undefined && !schema.required.includes(field)) { note(id, field, 'not recorded'); continue }
      if (!schema.properties[field].enum.includes(value)) errors.push({ id, field, reason: 'Invalid or missing enum value' })
      else if (value === null) note(id, field, 'not recorded')
    }
    for (const field of ['primaryMuscles', 'secondaryMuscles', 'instructions', 'images']) {
      if (!strings(record[field])) { errors.push({ id, field, reason: 'Expected string array without NUL' }); continue }
      if (field.endsWith('Muscles')) {
        const allowed = schema.properties[field].items[0].enum
        if (record[field].some(value => !allowed.includes(value))) errors.push({ id, field, reason: 'Unknown muscle label' })
        if (new Set(record[field]).size !== record[field].length) note(id, field, 'duplicate muscle labels')
      }
      if (field !== 'secondaryMuscles' && !record[field].length) note(id, field, 'empty array')
      if (record[field].some(value => !value.trim())) note(id, field, 'blank item')
    }
    if (Array.isArray(record.primaryMuscles) && record.primaryMuscles.length > 1) note(id, 'primaryMuscles', 'multiple primary targets; analytics primary unresolved')
    // JSONB cannot store NUL anywhere, including unknown fields retained verbatim.
    if (hasNul(record)) errors.push({ id, reason: 'NUL is not supported by PostgreSQL JSONB' })
    if (errors.length !== errorCount) continue
    const references = record.images.map(path => {
      if (!/^[0-9a-zA-Z_-]+\/[0-9a-zA-Z_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)) {
        errors.push({ id, field: 'images', reason: `Unsafe/non-relative image path: ${path}` }); return null
      }
      const file = files.get(`exercises/${path}`)
      if (!file) note(id, 'images', `not found in pinned Git tree: ${path}`)
      if (path.split('/')[0] !== record.id) note(id, 'images', `image belongs to another source folder: ${path}`)
      return { path, url: file ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${revision}/exercises/${path.split('/').map(encodeURIComponent).join('/')}` : null, git_blob_sha: file?.sha ?? null, rights_status: 'unverified' }
    })
    if (errors.length !== errorCount) continue
    const steps = record.instructions.filter(value => value.trim())
    rows.push({
      id: `${provider}:${record.id}`, name: record.name,
      primary_muscle: record.primaryMuscles.length === 1 ? record.primaryMuscles[0] : null,
      equipment: record.equipment, instructions: steps.length ? steps.join('\n\n') : null,
      source_provider: provider, source_id: record.id, source_revision: revision,
      source_metadata: { record: structuredClone(record), image_references: references },
    })
  }
  const usable = records.filter(record => text(record?.id) && text(record?.name))
  const duplicateIds = group(usable, record => record.id).map(([id, records]) => ({ id, count: records.length }))
  for (const duplicate of duplicateIds) errors.push({ id: duplicate.id, reason: `Duplicate source ID (${duplicate.count} records)` })
  const duplicateNames = group(usable, record => record.name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()).map(([name, records]) => ({ name, ids: records.map(record => record.id) }))
  const duplicateImages = group(imageIndex, file => file.sha).map(([sha, files]) => ({ sha, paths: files.map(file => file.path) }))
  const repeatedReferences = group(rows.flatMap(row => row.source_metadata.image_references.map(ref => ({ id: row.source_id, path: ref.path }))), ref => ref.path).map(([path, refs]) => ({ path, ids: refs.map(ref => ref.id) }))
  rows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return { rows, report: {
    provider, revision, exerciseCount: records.length, mappedCount: rows.length, readyForSqlGeneration: errors.length === 0,
    imageReferenceCount: rows.reduce((count, row) => count + row.source_metadata.image_references.length, 0),
    missing: Object.fromEntries(['force', 'mechanic', 'equipment', 'primaryMuscles', 'instructions', 'images'].map(field => [field, issues.filter(issue => issue.field === field && ['not recorded', 'empty array'].includes(issue.reason)).length])),
    duplicateIds, duplicateNames, duplicateImageBlobs: duplicateImages, repeatedImageReferences: repeatedReferences, errors, issues,
  } }
}

export function importSql(prepared) {
  if (!prepared.report.readyForSqlGeneration || prepared.report.errors.length) throw new Error('Refusing SQL generation for invalid/duplicate records.')
  const columns = ['id', 'name', 'primary_muscle', 'equipment', 'instructions', 'source_provider', 'source_id', 'source_revision', 'source_metadata']
  const values = prepared.rows.map(row => `(${columns.map(key => sqlText(key === 'source_metadata' ? JSON.stringify(row[key]) : row[key]) + (key === 'source_metadata' ? '::jsonb' : '')).join(', ')})`)
  const mutable = columns.filter(key => !['id', 'source_provider', 'source_id'].includes(key))
  return `-- GENERATED REVIEW-ONLY IMPORT. NEVER EXECUTED BY THIS TOOL.
-- Requires approved revised 20261009_02 catalogue/programmes proposal only.
-- Source ${provider} @ ${prepared.report.revision}; no images displayed/hosted.
BEGIN;
SET LOCAL standard_conforming_strings = on;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $arc_fit_identity_check$
BEGIN
  IF EXISTS (SELECT 1 FROM public.exercise_catalogue
    WHERE id LIKE 'free-exercise-db:%' AND (source_provider IS DISTINCT FROM 'free-exercise-db'
      OR id IS DISTINCT FROM source_provider || ':' || source_id)) THEN
    RAISE EXCEPTION 'Provider identity collision; import aborted';
  END IF;
END;
$arc_fit_identity_check$;
${values.length ? `INSERT INTO public.exercise_catalogue (${columns.join(', ')}) VALUES\n${values.join(',\n')}\nON CONFLICT (id) DO UPDATE SET\n${mutable.map(key => `  ${key} = EXCLUDED.${key}`).join(',\n')}\nWHERE (${mutable.map(key => `exercise_catalogue.${key}`).join(', ')})\n  IS DISTINCT FROM (${mutable.map(key => `EXCLUDED.${key}`).join(', ')});` : '-- No rows in validated input.'}
COMMIT;
-- No DELETE, personal identity updates, credentials or database connection.
`
}

function main() {
  const args = process.argv.slice(2)
  if (args.length && (args[0] !== '--out-dir' || args.length !== 2)) throw new Error('Usage: node scripts/prepare-free-exercise-db.mjs [--out-dir <directory>]')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), source = resolve(root, 'data/catalogue/free-exercise-db')
  const manifest = JSON.parse(readFileSync(resolve(source, 'source-manifest.json'), 'utf8'))
  for (const [file, hash] of Object.entries(manifest.sha256)) {
    if (sha256(readFileSync(resolve(source, file))) !== hash) throw new Error(`Snapshot checksum mismatch: ${file}`)
  }
  const input = JSON.parse(readFileSync(resolve(source, 'exercises.json'), 'utf8'))
  const prepared = prepareCatalogue(input, { revision: manifest.revision, schema: JSON.parse(readFileSync(resolve(source, 'schema.json'), 'utf8')), imageIndex: JSON.parse(readFileSync(resolve(source, 'image-index.json'), 'utf8')) })
  console.log(JSON.stringify({ exercises: prepared.report.exerciseCount, mapped: prepared.report.mappedCount, images: prepared.report.imageReferenceCount, missing: prepared.report.missing, errors: prepared.report.errors.length, duplicateIds: prepared.report.duplicateIds.length, duplicateNames: prepared.report.duplicateNames.length, duplicateImageBlobGroups: prepared.report.duplicateImageBlobs.length, issues: prepared.report.issues.length, sqlGenerationRequested: !!args.length, databaseExecuted: false }, null, 2))
  if (!prepared.report.readyForSqlGeneration) { console.error(JSON.stringify(prepared.report.errors)); process.exitCode = 1; return }
  if (args.length) {
    const out = resolve(args[1])
    const artifacts = { 'audit.json': JSON.stringify(prepared.report, null, 2) + '\n', 'catalogue.normalized.json': JSON.stringify(prepared.rows, null, 2) + '\n', 'catalogue-import_PROPOSAL.sql': importSql(prepared) }
    for (const [file, contents] of Object.entries(artifacts)) {
      const target = resolve(out, file)
      if (existsSync(target) && readFileSync(target, 'utf8') !== contents) throw new Error(`Refusing to overwrite a different artifact: ${target}. Choose a new output directory.`)
    }
    mkdirSync(out, { recursive: true })
    for (const [file, contents] of Object.entries(artifacts)) writeFileSync(resolve(out, file), contents, 'utf8')
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
