import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
let user = 'a', response, calls, results
const mock = { auth: { getSession: async () => ({ data: { session: user ? { user: { id: user } } : null }, error: null }) }, from(table) { calls.push(['from', table]); const query = { then(resolve, reject) { return Promise.resolve(results?.length ? results.shift() : response).then(resolve, reject) } }; for (const method of ['select', 'eq', 'order', 'is']) query[method] = (...args) => { calls.push([method, ...args]); return query }; return query } }
const bundled = await build({ stdin: { contents: "export * from './src/features/workout/planner';export * from './src/features/workout/routines';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'mock', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'test-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url)
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(name => name === 'test-client' ? { supabase: mock } : require(name), module, module.exports)
const { dayNames, moveExercise, validatePlan, listSavedDays, listDayExercises } = module.exports
test('PPL six-day defaults and flexible split names are deterministic', () => {
  assert.deepEqual(dayNames('PPL', 6), ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'])
  assert.deepEqual(dayNames('Upper/Lower', 4), ['Upper A', 'Lower A', 'Upper B', 'Lower B'])
  assert.equal(dayNames('Custom', 9)[8], 'Day 9')
  assert.equal(dayNames('Two muscles', 2, ['Chest', 'Back'])[1], 'Chest / Back B')
  assert.equal(dayNames('Three muscles', 1, ['Chest', 'Back', 'Legs'])[0], 'Chest / Back / Legs A')
  assert.equal(dayNames('Full Body', 28)[27], 'Full Body AB')
  assert.throws(() => dayNames('PPL', 0))
})
test('ordering is immutable and boundary moves do not lose exercises', () => {
  const original = ['a', 'b', 'c']
  assert.deepEqual(moveExercise(original, 1, -1), ['b', 'a', 'c'])
  assert.deepEqual(original, ['a', 'b', 'c'])
  assert.equal(moveExercise(original, 0, -1), original)
})
test('planned sets and rep ranges respect verified routine constraints', () => {
  const plan = { exerciseId: 'a', name: 'Synthetic', sets: 3, min: 8, max: 12 }
  assert.equal(validatePlan(plan), '')
  assert.ok(validatePlan({ ...plan, sets: 21 }))
  assert.ok(validatePlan({ ...plan, min: 13 }))
  assert.ok(validatePlan({ ...plan, min: null }))
  assert.equal(validatePlan({ ...plan, min: null, max: null }), '')
})
test('saved routine reads filter ownership and day identity, never write', async () => {
  calls = []; user = 'a'; response = { data: [{ id: 'day', user_id: 'a', name: 'Synthetic', sequence_number: 1 }], error: null }
  await listSavedDays('a')
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'a'))
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'is_active'))
  calls = []; response = { data: [{ id: 'entry', user_id: 'a', routine_day_id: 'day' }], error: null }
  await listDayExercises('a', 'day')
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'routine_day_id' && call[2] === 'day'))
  assert.ok(!calls.some(call => ['insert', 'update', 'delete'].includes(call[0])))
})
test('saved routine reads reject mismatched sessions and returned ownership', async () => {
  calls = []; user = null
  await assert.rejects(listSavedDays('a'))
  assert.deepEqual(calls, [])
  user = 'a'; response = { data: [{ user_id: 'b' }], error: null }
  await assert.rejects(listSavedDays('a'))
  response = { data: [{ user_id: 'a', routine_day_id: 'different' }], error: null }
  await assert.rejects(listDayExercises('a', 'day'))
})

test('legacy day fallback is limited to the absent programme_id column, not arbitrary errors', async () => {
  calls = []; user = 'a'; results = [{ data: null, error: { code: '42703', message: 'column routine_days.programme_id does not exist' } }, { data: [{ id: 'legacy', user_id: 'a' }], error: null }]
  assert.equal((await listSavedDays('a'))[0].id, 'legacy')
  assert.equal(calls.filter(call => call[0] === 'from').length, 2)
  calls = []; results = [{ data: null, error: { code: '42703', message: 'unknown name column' } }]
  await assert.rejects(() => listSavedDays('a'))
  assert.equal(calls.filter(call => call[0] === 'from').length, 1)
  results = null
})
