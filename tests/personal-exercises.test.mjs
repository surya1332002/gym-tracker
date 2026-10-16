import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
let account = 'account-a'
let sessionCalls = 0
let switchAfter = Infinity
let response
let calls
const mock = {
  auth: { async getSession() { sessionCalls++; return { data: { session: account ? { user: { id: sessionCalls > switchAfter ? 'account-b' : account } } : null }, error: null } } },
  from(table) {
    calls.push(['from', table])
    const query = { then(resolve, reject) { return Promise.resolve(response).then(resolve, reject) } }
    for (const method of ['select', 'eq', 'order', 'insert', 'update', 'single']) query[method] = (...args) => { calls.push([method, ...args]); return query }
    return query
  },
}
const bundled = await build({ stdin: { contents: "export * from './src/features/exercises/personal';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'isolated-client', setup(builder) { builder.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'test-client', external: true })) } }] })
const module = { exports: {} }
const require = createRequire(import.meta.url)
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(name => name === 'test-client' ? { supabase: mock } : require(name), module, module.exports)
const { validateInput, listPersonalExercises, savePersonalExercise, archivePersonalExercise, filterPersonalExercises } = module.exports
const input = { name: '  My movement  ', primary_muscle: 'Back', equipment: 'Cable', instructions: 'Do this', notes: 'Private', weight_unit: 'lb', weight_increment: '2.5' }
const row = { id: 'exercise-a', user_id: 'account-a', ...input, weight_increment: 2.5, is_archived: false }
function reset(data = row) { account = 'account-a'; sessionCalls = 0; switchAfter = Infinity; calls = []; response = { data, error: null } }
test('input validation supports kg/lb, optional increments and rejects invalid values', () => {
  assert.equal(validateInput(input).name, 'My movement')
  assert.equal(validateInput({ ...input, weight_increment: '' }).weight_increment, null)
  for (const value of ['0', '-1', 'Infinity', 'NaN', 'not-number']) assert.throws(() => validateInput({ ...input, weight_increment: value }))
  assert.throws(() => validateInput({ ...input, weight_unit: 'stone' }))
  assert.throws(() => validateInput({ ...input, primary_muscle: ' ' }))
})
test('create explicitly assigns authenticated ownership and validated preferences', async () => {
  reset()
  assert.equal((await savePersonalExercise('account-a', input)).id, row.id)
  const inserted = calls.find(call => call[0] === 'insert')[1]
  assert.equal(inserted.user_id, 'account-a')
  assert.equal(inserted.weight_unit, 'lb')
  assert.equal(inserted.weight_increment, 2.5)
  assert.ok(!('id' in inserted))
})
test('read, edit and archive constrain queries to owner; archive never deletes', async () => {
  reset([row]); await listPersonalExercises('account-a')
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'account-a'))
  reset(); await savePersonalExercise('account-a', input, row.id)
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'id' && call[2] === row.id))
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'user_id'))
  assert.ok(!('user_id' in calls.find(call => call[0] === 'update')[1]))
  reset(); await archivePersonalExercise('account-a', row.id)
  assert.equal(calls.find(call => call[0] === 'update')[1].is_archived, true)
  assert.ok(!calls.some(call => call[0] === 'delete'))
})
test('signed out or mismatched identity makes no database request', async () => {
  reset(); account = null
  await assert.rejects(listPersonalExercises('account-a'))
  assert.deepEqual(calls, [])
  reset(); account = 'account-b'
  await assert.rejects(savePersonalExercise('account-a', input))
  await assert.rejects(archivePersonalExercise('account-a', row.id))
  assert.deepEqual(calls, [])
})
test('foreign-account responses and account changes during requests are rejected', async () => {
  reset([{ ...row, user_id: 'account-b' }]); await assert.rejects(listPersonalExercises('account-a'))
  reset({ ...row, user_id: 'account-b' }); await assert.rejects(savePersonalExercise('account-a', input))
  reset([row]); switchAfter = 1
  await assert.rejects(listPersonalExercises('account-a'))
})
test('database failures are not reported as successful saves', async () => {
  reset(); response = { data: null, error: new Error('synthetic RLS denial') }
  await assert.rejects(savePersonalExercise('account-a', input), /RLS denial/)
  await assert.rejects(archivePersonalExercise('account-a', row.id), /RLS denial/)
})
test('personal search combines muscle/equipment, hides archived rows and supports legacy empty metadata', () => {
  const data = [{ ...row, name: 'Cable Row' }, { ...row, id: 'archived', name: 'Cable Pull', is_archived: true }]
  assert.equal(filterPersonalExercises(data, '  CABLE ', 'Back', 'Cable', false).length, 1)
  assert.equal(filterPersonalExercises(data, 'cable', 'Back', 'Cable', true).length, 2)
  assert.equal(filterPersonalExercises(data, 'row', 'Chest', '', false).length, 0)
  assert.equal(filterPersonalExercises([{ ...row, primary_muscle: null, equipment: null }], '', 'Not recorded', '__not_recorded__', false).length, 1)
})
