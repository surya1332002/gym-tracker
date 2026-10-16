import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const output = await build({ stdin: { contents: "export * from './src/features/workout/WorkoutGroups';export {default as WorkoutGroups} from './src/features/workout/WorkoutGroups';export * from './src/features/home/rotation';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', output.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { WorkoutGroups, workoutBlocks, groupRounds, addWorkoutRound, latestQualifyingWorkout, nextConfiguredDay, createRotationRepository } = module.exports
const group = { id: 'g', type: 'superset', name: 'Superset' }, set = (number, completed = false) => ({ id: `set-${number}`, number, lb: completed ? '100.123456' : '', reps: completed ? '8' : '', completed, completedAt: completed ? '2026-10-14T10:00:00Z' : null, notes: '' }), exercise = (id, sets, grouped = true) => ({ id, exerciseId: id, name: id, nextNumber: Math.max(0, ...sets.map(s => s.number)) + 1, sets, ...(grouped ? { group } : {}) })
test('group cards collect stable group identities without changing any exercise identity or underlying order', () => {
  const rows = [exercise('a', [], true), exercise('solo', [], false), exercise('b', [], true)], original = structuredClone(rows), blocks = workoutBlocks(rows)
  assert.deepEqual(blocks.map(b => b.indices), [[0, 2], [1]]); assert.equal(blocks[0].key, 'group:g'); assert.deepEqual(rows, original)
})
test('round summaries use stable set numbers and retain deleted-number gaps without inventing rounds', () => {
  const rows = [exercise('a', [set(1, true), set(3, true)]), exercise('b', [set(1, true), set(4, false)])]
  assert.deepEqual(groupRounds(rows, [0, 1]), [{ round: 1, completed: 2, total: 2 }, { round: 3, completed: 1, total: 2 }, { round: 4, completed: 0, total: 2 }])
})
test('Add Round adds one synchronized blank/uncompleted set to each group member, preserving all completed work', () => {
  const rows = [exercise('a', [set(1, true)]), exercise('b', [set(3, true)]), exercise('solo', [set(1, true)], false)], original = structuredClone(rows), next = addWorkoutRound(rows, 'g')
  assert.deepEqual(rows, original); assert.deepEqual(next[0].sets[0], original[0].sets[0]); assert.deepEqual(next[1].sets[0], original[1].sets[0]); assert.equal(next[0].sets.at(-1).number, 4); assert.equal(next[1].sets.at(-1).number, 4); assert.notEqual(next[0].sets.at(-1).id, next[1].sets.at(-1).id)
  for (const item of next.slice(0, 2)) { const added = item.sets.at(-1); assert.equal(added.lb, ''); assert.equal(added.reps, ''); assert.equal(added.completed, false); assert.equal(added.completedAt, null); assert.equal(item.nextNumber, 5) }
  assert.deepEqual(next[2], original[2]); assert.throws(() => addWorkoutRound([exercise('a', [set(100)])], 'g'), /100 sets/)
})
test('rotation only follows actual qualifying finished workouts and never guesses across programmes or changed days', () => {
  const first = { id: 'first', userId: 'own', dayId: 'old-day', name: 'Push', date: '2026-10-12', startedAt: '2026-10-12T09:00:00Z', completedAt: '2026-10-12T10:00:00Z', advanceRotation: true, exercises: [] }
  assert.equal(latestQualifyingWorkout([first, { ...first, id: 'pending', date: '2026-10-14', completedAt: null }, { ...first, id: 'partial', date: '2026-10-14', completionKind: 'incomplete' }, { ...first, id: 'random', date: '2026-10-14', dayId: null }]).id, 'first')
  const days = [{ id: 'new-push', programme_id: 'p', name: 'Push', sequence_number: 1 }, { id: 'pull', programme_id: 'p', name: 'Pull', sequence_number: 2 }]
  assert.equal(nextConfiguredDay(days, { id: 'old-day', programme_id: 'p', name: 'Push', sequence_number: 1 }).id, 'pull'); assert.equal(nextConfiguredDay(days, { id: 'old-day', programme_id: 'p', name: 'Changed', sequence_number: 1 }), null); assert.equal(nextConfiguredDay(days, { id: 'other', programme_id: 'another', name: 'Push', sequence_number: 1 }).id, 'new-push')
})
test('Home derives programme from retained owned day rather than any programme name', async () => {
  const rows = [{ id: 'first', user_id: 'own', name: 'Any first programme', revision: 1 }, { id: 'actual', user_id: 'own', name: 'My chosen training', revision: 3 }], requested = []
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'own' } } } }) }, from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { id: 'old', user_id: 'own', programme_id: 'actual', name: 'Legs', sequence_number: 1 } }) }) }, programmes = { listProgrammes: async () => rows, listProgrammeDays: async (_owner, id) => { requested.push(id); return [{ id: 'new', programme_id: id, name: 'Legs', sequence_number: 1 }] } }
  const repo = createRotationRepository(client, programmes), result = await repo.load('own', { userId: 'own', dayId: 'old' }); assert.equal(result.programme.id, 'actual'); assert.deepEqual(requested, ['actual'])
  const fallback = await repo.load('own', null); assert.equal(fallback.programme.id, 'first')
})
test('group UI disables Add Round in read-only and set-limit states and opens the focused group', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), rows = [exercise('a', [set(1, true)]), exercise('b', [set(1)])]
  const render = (exercises, readOnly, focusedIndex) => renderToStaticMarkup(React.createElement(WorkoutGroups, { exercises, readOnly, focusedIndex, renderExercise: index => React.createElement('p', null, exercises[index].id), onChange: () => { throw new Error('Read-only rendering must never write') } }))
  assert.match(render(rows, true, 0), /<details[^>]*open=""/); assert.match(render(rows, true, 0), /<button[^>]*disabled=""/)
  assert.doesNotMatch(render(rows, false, undefined), /<button[^>]*disabled=""/)
  const staleNext = exercise('a', [set(100)]); staleNext.nextNumber = 1; assert.match(render([staleNext], false, undefined), /<button[^>]*disabled=""/)
})
