import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const built = await build({ entryPoints: ['src/features/workout/WorkoutCalendar.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url)
new Function('require', 'module', 'exports', built.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { monthDays, completedByDate } = module.exports
test('calendar aligns Monday-first months and preserves leap-day and year boundaries without UTC conversion', () => {
  const february = monthDays(2024, 1)
  assert.deepEqual(february.slice(0, 4), [null, null, null, '2024-02-01'])
  assert.equal(february.at(-1), '2024-02-29')
  assert.equal(monthDays(2025, 11).filter(Boolean).length, 31)
  assert.equal(monthDays(2026, 0).filter(Boolean)[0], '2026-01-01')
})
test('calendar groups actual completed history only; unfinished, undated and invalid records never become markers', () => {
  const row = { id: 'a', status: 'completed', completed_at: '2026-10-10T12:00:00Z', workout_date: '2026-10-10', routine_name_snapshot: 'Push A' }
  const result = completedByDate([row, row, { ...row, id: 'b' }, { ...row, id: 'active', status: 'in_progress' }, { ...row, id: 'unfinished', completed_at: null }, { ...row, id: 'excel', workout_date: '' }, { ...row, id: 'invalid', workout_date: '2026-02-31' }])
  assert.equal(result.size, 1)
  assert.deepEqual(result.get('2026-10-10').map(item => item.id), ['a', 'b'])
})
