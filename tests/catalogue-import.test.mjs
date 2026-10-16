import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { prepareCatalogue, importSql, sqlText, sha256 } from '../scripts/prepare-free-exercise-db.mjs'
const source = 'data/catalogue/free-exercise-db'
const json = name => JSON.parse(readFileSync(`${source}/${name}`, 'utf8'))
const manifest = json('source-manifest.json')
const options = { revision: manifest.revision, schema: json('schema.json'), imageIndex: json('image-index.json') }
const records = json('exercises.json')
const example = () => structuredClone(records[0])

test('official snapshot provenance matches all stored bytes; 876 unique records map without loss', () => {
  for (const [file, hash] of Object.entries(manifest.sha256)) assert.equal(sha256(readFileSync(`${source}/${file}`)), hash)
  const { rows, report } = prepareCatalogue(records, options)
  assert.equal(report.exerciseCount, 876); assert.equal(report.mappedCount, 876)
  assert.equal(report.readyForSqlGeneration, true)
  assert.deepEqual(report.duplicateIds, []); assert.deepEqual(report.duplicateNames, [])
  assert.equal(new Set(rows.map(row => row.id)).size, 876)
  for (const record of records) {
    const row = rows.find(item => item.source_id === record.id)
    assert.equal(row.id, `free-exercise-db:${record.id}`)
    assert.equal(row.name, record.name)
    assert.deepEqual(row.source_metadata.record, record)
  }
})
test('all 1746 image references exist in pinned tree; rights are not inferred from availability', () => {
  const { rows, report } = prepareCatalogue(records, options)
  assert.equal(report.imageReferenceCount, 1746)
  assert.equal(report.issues.filter(issue => issue.reason.includes('not found')).length, 0)
  assert.equal(report.duplicateImageBlobs.length, 22)
  assert.equal(report.duplicateImageBlobs.reduce((n, group) => n + group.paths.length - 1, 0), 25)
  for (const row of rows) for (const image of row.source_metadata.image_references) {
    assert.ok(image.url.includes(`/${manifest.revision}/exercises/`))
    assert.equal(image.rights_status, 'unverified'); assert.ok(image.git_blob_sha)
  }
})
test('incomplete fields are flagged and preserved; multiple primaries never silently choose an analytics target', () => {
  const { rows, report } = prepareCatalogue(records, options)
  assert.deepEqual(report.missing, { force: 30, mechanic: 87, equipment: 77, primaryMuscles: 0, instructions: 5, images: 3 })
  assert.equal(report.issues.filter(issue => issue.field === 'instructions' && issue.reason === 'blank item').length, 2)
  const multi = rows.find(row => row.source_id === 'Kettlebell_Halo_With_Overhead_Extension')
  assert.equal(multi.primary_muscle, null)
  assert.deepEqual(multi.source_metadata.record.primaryMuscles, ['shoulders', 'triceps'])
  assert.equal(rows.filter(row => row.equipment === null).length, 77)
  assert.equal(rows.filter(row => row.instructions === null).length, 5)
})
test('duplicate source IDs fail SQL generation; similar names with distinct IDs are reported without merging', () => {
  const row = example(), duplicate = prepareCatalogue([row, structuredClone(row)], options)
  assert.equal(duplicate.report.readyForSqlGeneration, false)
  assert.throws(() => importSql(duplicate), /invalid\/duplicate/)
  const other = { ...row, id: 'Other_ID', name: `  ${row.name.toUpperCase()}  ` }
  const prepared = prepareCatalogue([row, other], options)
  assert.equal(prepared.rows.length, 2)
  assert.equal(prepared.report.duplicateNames.length, 1)
  assert.equal(prepared.report.duplicateIds.length, 0)
})
test('malformed records and all array items are validated beyond the permissive upstream schema', () => {
  for (const patch of [{ id: '' }, { name: null }, { equipment: 'invented' }, { instructions: [4] }, { primaryMuscles: ['chest', 'invented'] }, { extra: 'NUL\0value' }]) {
    const prepared = prepareCatalogue([{ ...example(), ...patch }], options)
    assert.equal(prepared.report.readyForSqlGeneration, false)
    assert.throws(() => importSql(prepared))
  }
  assert.throws(() => prepareCatalogue({}, options), /array/)
  assert.throws(() => prepareCatalogue(records, { ...options, revision: 'main' }), /pinned/)
})
test('instructions stay ordered and raw blanks are retained without invented steps', () => {
  const row = { ...example(), instructions: ['First.', ' ', 'Second.'] }
  const result = prepareCatalogue([row], options).rows[0]
  assert.equal(result.instructions, 'First.\n\nSecond.')
  assert.deepEqual(result.source_metadata.record.instructions, row.instructions)
  result.source_metadata.record.instructions[0] = 'Changed'
  assert.equal(row.instructions[0], 'First.')
})
test('unsafe media paths fail; missing source files remain unresolved references without fabricated URLs', () => {
  for (const path of ['../secret.jpg', 'https://other.invalid/image.jpg', 'Folder/../image.jpg']) {
    assert.equal(prepareCatalogue([{ ...example(), images: [path] }], options).report.readyForSqlGeneration, false)
  }
  const result = prepareCatalogue([example()], { ...options, imageIndex: [] })
  assert.ok(result.report.issues.some(issue => issue.reason.includes('not found')))
  assert.equal(result.rows[0].source_metadata.image_references[0].url, null)
})
test('SQL targets shared catalogue only, keeps stable keys and updates only changed shared metadata', () => {
  const prepared = prepareCatalogue(records, options), sql = importSql(prepared)
  assert.ok(sql.includes('INSERT INTO public.exercise_catalogue'))
  assert.ok(sql.includes('ON CONFLICT (id) DO UPDATE'))
  assert.ok(sql.includes('IS DISTINCT FROM'))
  assert.ok(sql.includes('Provider identity collision; import aborted'))
  assert.ok(!sql.includes('INSERT INTO public.exercises'))
  assert.ok(!sql.includes('DELETE FROM'))
  assert.equal(importSql(prepareCatalogue(records, options)), sql)
  assert.equal(importSql(prepareCatalogue([...records].reverse(), options)), sql)
})
test('apostrophes/backslashes remain quoted data, not executable SQL statements', () => {
  assert.equal(sqlText("O'Brien"), "'O''Brien'")
  const row = { ...example(), name: "x'); DROP TABLE private; --", instructions: ["A\\B 'quoted' step"] }
  const sql = importSql(prepareCatalogue([row], options))
  assert.ok(sql.includes("'x''); DROP TABLE private; --'"))
  assert.ok(sql.includes('standard_conforming_strings = on'))
})
test('offline CLI generates review artifacts identically on repeat and never executes SQL', () => {
  const out = mkdtempSync(join(tmpdir(), 'arc-fit-catalogue-test-'))
  try {
    const run = () => JSON.parse(execFileSync(process.execPath, [resolve('scripts/prepare-free-exercise-db.mjs'), '--out-dir', out], { encoding: 'utf8' }))
    assert.equal(run().databaseExecuted, false)
    const first = Object.fromEntries(readdirSync(out).map(name => [name, sha256(readFileSync(join(out, name)))]))
    assert.equal(run().exercises, 876)
    assert.deepEqual(Object.fromEntries(readdirSync(out).map(name => [name, sha256(readFileSync(join(out, name)))])), first)
  } finally { rmSync(out, { recursive: true }) }
})
