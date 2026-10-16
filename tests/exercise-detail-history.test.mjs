import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const output = await build({ entryPoints: ['src/features/exercises/detailHistory.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' })
const module = { exports: {} }; new Function('module', 'exports', output.outputFiles[0].text)(module, module.exports)
const { filterExerciseSessions, exerciseHistoryPoints, exerciseHistoryPrs } = module.exports
const actualSet = (id, kg, reps, completed = true) => ({ id, number: 1, lb: kg === null ? '' : String(kg / 0.45359237), weightKg: kg, reps: String(reps), completed, completedAt: completed ? '2026-10-14T10:00:00Z' : null }), exercise = (id, sets) => ({ id, exerciseId: 'exercise', name: 'Synthetic press', muscle: 'Chest', sets }), session = (id, name, date, exercises, extra = {}) => ({ id, name, date, startedAt: `${date}T09:00:00Z`, completedAt: `${date}T10:00:00Z`, exercises, ...extra })
test('routine/date filters preserve exact records and do not alter original sessions', () => {
  const rows = [session('a', 'Push A', '2026-10-10', [exercise('instance', [actualSet('s', 10, 10)])]), session('b', 'Push B', '2026-10-14', [exercise('instance', [actualSet('s', 20, 5)])])], original = structuredClone(rows)
  assert.deepEqual(filterExerciseSessions(rows, 'exercise', 'Push B', '2026-10-12', '2026-10-15').map(row => row.id), ['b']); assert.equal(filterExerciseSessions(rows, 'exercise', '', '2026-10-15', '2026-10-12').length, 0); assert.deepEqual(rows, original)
})
test('repeated exercise slots in one session aggregate volume/working sets without changing attribution or records', () => {
  const rows = [session('a', 'Push A', '2026-10-14', [exercise('first', [actualSet('a', 10, 10)]), exercise('second', [actualSet('b', 15, 8), actualSet('planned', 100, 20, false)])])], original = structuredClone(rows), [point] = exerciseHistoryPoints(rows, 'exercise')
  assert.equal(point.volumeKg, 220); assert.equal(point.workingSets, 2); assert.equal(point.weightKg, 15); assert.equal(point.loads.length, 2); assert.deepEqual(rows, original)
})
test('unknown loads remain unknown in PRs and active/incomplete actual work remains eligible', () => {
  const bodyweight = session('unknown', 'Pull', '2026-10-14', [exercise('a', [actualSet('body', null, 12)])]), [point] = exerciseHistoryPoints([bodyweight], 'exercise'), unknown = exerciseHistoryPrs([point])
  assert.equal(unknown.heaviestKg, null); assert.equal(unknown.estimated1RmKg, null); assert.equal(unknown.bestSessionVolumeKg, null); assert.equal(unknown.repsAtTopLoad, null)
  const active = session('active', 'Push', '2026-10-14', [exercise('a', [actualSet('real', 20, 5)])], { completedAt: null }), partial = session('partial', 'Push', '2026-10-13', [exercise('b', [actualSet('real2', 25, 6)])], { completionKind: 'incomplete' })
  const prs = exerciseHistoryPrs(exerciseHistoryPoints([active, partial], 'exercise')); assert.equal(prs.heaviestKg, 25); assert.equal(prs.repsAtTopLoad, 6); assert.equal(prs.bestSessionVolumeKg, 150); assert.equal(prs.estimated1RmKg, 30)
})
test('deleted workouts and unfinished planned sets cannot create detail PRs', () => {
  const rows = [session('trash', 'Push', '2026-10-14', [exercise('a', [actualSet('fake', 100, 10)])], { deletedAt: '2026-10-14T11:00:00Z' }), session('planned', 'Push', '2026-10-14', [exercise('a', [actualSet('planned', 100, 10, false)])], { completedAt: null })]
  assert.equal(exerciseHistoryPoints(rows, 'exercise').length, 0)
})
test('detail screen and native progression chart bundle and provide accessible recorded values without writing', async () => {
  const ui = await build({ stdin: { contents: "export {default as PersonalDetails} from './src/features/exercises/PersonalDetails';export {default as ExerciseHistoryChart} from './src/features/exercises/ExerciseHistoryChart';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
  const rendered = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', ui.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), rendered, rendered.exports)
  assert.equal(typeof rendered.exports.PersonalDetails, 'function'); const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), points = exerciseHistoryPoints([session('a', 'Push', '2026-10-14', [exercise('a', [actualSet('real', 15, 8)])])], 'exercise'), html = renderToStaticMarkup(React.createElement(rendered.exports.ExerciseHistoryChart, { points, unit: 'kg' }))
  assert.match(html, /role="img"/); assert.match(html, /Recorded chart values/); assert.match(html, /15.00 kg/); assert.match(html, /2026-10-14/)
})
