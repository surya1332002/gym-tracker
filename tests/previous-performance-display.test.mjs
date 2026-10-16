import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const output = await build({ stdin: { contents: "export {default as PreviousPerformance,mostRecentOverallReference} from './src/features/workout/PreviousPerformance';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', output.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { PreviousPerformance, mostRecentOverallReference } = module.exports, React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const reference = (id, day, date) => ({ id, exercise_id: 'exercise', routine_day_id: day, performance_date: date, source_key: id, source_fields: { completed_at: date ? `${date}T10:00:00Z` : '' }, recorded_sets: [{ number: 1, weight_lb: 90, reps: 12, raw_weight: '90', raw_reps: '12' }], machine_settings: 'Synthetic seat setting', per_side_qualifiers: '', original_notes: 'Synthetic note' })
test('same-day reference and newer overall performance are shown separately with an evidence-based progression suggestion', () => {
  const rows = [reference('same', 'push-a', '2026-10-12'), reference('newer', 'push-b', '2026-10-14')]
  const html = renderToStaticMarkup(React.createElement(PreviousPerformance, { references: rows, exerciseId: 'exercise', dayId: 'push-a', max: 12, increment: 2.5, unit: 'lb' }))
  assert.match(html, /2026-10-12/); assert.match(html, /Most recent overall: 2026-10-14/); assert.match(html, /All recorded sets reached 12 reps/); assert.match(html, /2.5 lb/); assert.match(html, /Complete each set yourself/)
})
test('undated references never acquire a most-recent date and ambiguous sources do not display invented performance', () => {
  const rows = [reference('one', 'push-a', null), reference('two', 'push-b', null)]
  assert.equal(mostRecentOverallReference(rows, 'exercise'), null)
  const html = renderToStaticMarkup(React.createElement(PreviousPerformance, { references: rows, exerciseId: 'exercise', dayId: 'another', max: 12, increment: 2.5 }))
  assert.match(html, /no known order/); assert.doesNotMatch(html, /Most recent overall/); assert.doesNotMatch(html, /90 lb/)
})
test('overall selection ignores workout-day preference and never mutates or changes unrelated records', () => {
  const rows = [reference('old-random', null, '2026-10-10'), reference('new-day', 'pull', '2026-10-14'), { ...reference('other', 'pull', '2026-10-15'), exercise_id: 'other-exercise' }], original = structuredClone(rows)
  assert.equal(mostRecentOverallReference(rows, 'exercise').id, 'new-day'); assert.deepEqual(rows, original)
})
