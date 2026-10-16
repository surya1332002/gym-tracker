import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const bundle = await build({ stdin: { contents: "export * from './src/features/exercises/catalogue'; export {default as CatalogueSelection} from './src/features/exercises/CatalogueSelection';", resolveDir: process.cwd(), loader: 'tsx' }, jsx: 'automatic', bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'offline', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url)
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { createCatalogueRepository, filterExercises, CatalogueSelection } = module.exports
const source = JSON.parse(readFileSync('data/catalogue/free-exercise-db/prepared/catalogue.normalized.json', 'utf8'))
const rows = source.map(row => ({ ...row, primary_muscles: row.source_metadata.record.primaryMuscles, secondary_muscles: row.source_metadata.record.secondaryMuscles, instruction_steps: row.source_metadata.record.instructions, category: row.source_metadata.record.category, level: row.source_metadata.record.level }))
function fixture(records = rows) {
  const calls = []
  let error = null
  return { calls, fail(value) { error = value }, client: { from(table) {
    calls.push(['from', table])
    const query = { select(fields) { calls.push(['select', fields]); return query }, order(field) { calls.push(['order', field]); return query }, async range(start, end) { calls.push(['range', start, end]); return { data: error ? null : records.slice(start, end + 1), error } } }
    return query
  } } }
}
test('shared repository retrieves all 876 identities and gates image references without private tables', async () => {
  const f = fixture(), result = await createCatalogueRepository(f.client).list()
  assert.equal(result.length, 876)
  assert.equal(new Set(result.map(row => row.catalogueId)).size, 876)
  assert.deepEqual(f.calls.filter(call => call[0] === 'range'), [['range', 0, 249], ['range', 250, 499], ['range', 500, 749], ['range', 750, 999]])
  assert.ok(f.calls.filter(call => call[0] === 'from').every(call => call[1] === 'exercise_catalogue'))
  assert.ok(f.calls.filter(call => call[0] === 'select').every(call => call[1].includes('image_references') && !call[1].includes('source_metadata')))
  assert.ok(result.every(row => row.images.length === 0))
  assert.ok(result.every(row => !('image_references' in row) && !('source_metadata' in row)))
})
test('multiple primary targets filter by either recorded target; missing equipment remains absent', async () => {
  const f = fixture(), result = await createCatalogueRepository(f.client).list()
  const multi = result.find(row => row.catalogueId === 'free-exercise-db:Kettlebell_Halo_With_Overhead_Extension')
  assert.deepEqual(multi.primaryMuscles, ['shoulders', 'triceps'])
  assert.equal(filterExercises([multi], '', 'shoulders', '').length, 1)
  assert.equal(filterExercises([multi], '', 'triceps', '').length, 1)
  assert.equal(result.filter(row => row.equipment === undefined).length, 77)
})
test('missing schema or partial-page failure rejects the whole catalogue instead of serving synthetic seeds', async () => {
  const f = fixture(); f.fail(new Error('catalogue schema not deployed'))
  await assert.rejects(() => createCatalogueRepository(f.client).list(), /not deployed/)
  assert.deepEqual(await createCatalogueRepository(fixture([]).client).list(), [])
  const bad = fixture([{ ...rows[0], instruction_steps: null }])
  await assert.rejects(() => createCatalogueRepository(bad.client).list(), /incomplete/)
  const duplicate = fixture([rows[0], rows[0]])
  await assert.rejects(() => createCatalogueRepository(duplicate.client).list(), /Duplicate/)
})
test('selection actions require account/membership readiness and only show Added for confirmed active mapping', () => {
  const render = props => renderToStaticMarkup(React.createElement(CatalogueSelection, props))
  const props = { userId: 'a', catalogueId: rows[0].id, ready: true }
  assert.match(render({ ...props, ready: false }), /disabled/)
  assert.ok(!render(props).includes('disabled'))
  assert.match(render(props), /Add to My List/)
  assert.ok(!render(props).includes('>Added<'))
  const membership = { id: 'personal', user_id: 'a', catalogue_id: rows[0].id, is_archived: false }
  assert.match(render({ ...props, membership }), />Added</)
  assert.match(render({ ...props, membership }), /Remove from My List/)
  assert.match(render({ ...props, membership: { ...membership, is_archived: true } }), /Add to My List/)
})
