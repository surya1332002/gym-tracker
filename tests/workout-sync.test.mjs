import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const bundle = await build({ stdin: { contents: "export * from './src/features/workout/sessions'; export * from './src/features/workout/sessionActions';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { createAtomicSessionRepository, elapsedSeconds, togglePause, replaceSessionExercise, groupExercises } = module.exports
const session = () => ({ id: 'workout', userId: 'own', dayId: null, name: 'Push A', date: '2026-10-10', startedAt: '2026-10-10T09:00:00Z', completedAt: null, revision: 0, exercises: [{ id: 'instance', exerciseId: 'exercise', name: 'Press', equipment: null, notes: '', instructions: '', min: 8, max: 12, settings: [], nextNumber: 2, sets: [{ id: 'set', number: 1, lb: '100', reps: '10', completed: false, completedAt: null, notes: '' }] }] })
function fixture() { let user = 'own', after = 'own', error = null; const calls = []; const client = { auth: { getSession: async () => ({ data: { session: { user: { id: user } } }, error: null }) }, from() { throw new Error('Atomic saves must not use direct table writes') }, rpc: async (name, args) => { calls.push({ name, args: structuredClone(args) }); user = after; return error ? { data: null, error } : { data: { id: args.p_id, user_id: args.p_payload.userId, revision: args.p_revision + 1 }, error: null } } }; return { repo: createAtomicSessionRepository(client), calls, setUser: value => { user = value }, setAfter: value => { after = value }, setError: value => { error = value } } }
test('atomic writer validates inputs and account before RPC and checks account after receipt', async () => {
  const f = fixture(); const bad = session(); bad.exercises[0].sets[0].reps = '2.5'; await assert.rejects(f.repo.save(bad), /whole number/); assert.equal(f.calls.length, 0)
  f.setUser('other'); await assert.rejects(f.repo.save(session()), /matching/); assert.equal(f.calls.length, 0)
  f.setUser('own'); f.setAfter('other'); await assert.rejects(f.repo.writeAttempt(session(), 'operation', 0), /account changed/); assert.equal(f.calls.length, 1)
})
test('invalid weights, reps and RPE and planned-only completion cannot reach the gateway', async () => {
  for (const patch of [{ lb: 'Infinity' }, { lb: '-1' }, { reps: '1001' }, { rpe: '11' }, { completed: true, reps: '' }]) {
    const f = fixture(), value = session(); Object.assign(value.exercises[0].sets[0], patch); await assert.rejects(f.repo.save(value)); assert.equal(f.calls.length, 0)
  }
  const f = fixture(), value = session(); value.completedAt = '2026-10-10T10:00:00Z'; await assert.rejects(f.repo.save(value, true), /actual set/); assert.equal(f.calls.length, 0)
})
test('ambiguous RPC failure retains operation identity and frozen request on retry', async () => {
  const f = fixture(), value = session(); f.setError({ code: 'network', message: 'Lost response' }); await assert.rejects(f.repo.save(value), /device copy/)
  f.setError(null); await f.repo.save(value); assert.equal(value.revision, 1); assert.equal(f.calls.length, 2); assert.deepEqual(f.calls[0], f.calls[1]); assert.equal(f.calls[0].name, 'arc_fit_sync_workout')
})
test('revision conflicts preserve recognizable code instead of claiming successful save', async () => {
  const f = fixture(); f.setError({ code: '40001', message: 'conflict' }); await assert.rejects(f.repo.writeAttempt(session(), 'operation', 0), e => e.code === '40001' && /Both versions/.test(e.message))
})
test('paused duration excludes pause intervals and manual override remains authoritative', () => {
  let value = togglePause(session(), new Date('2026-10-10T09:10:00Z')); assert.equal(elapsedSeconds(value, Date.parse('2026-10-10T09:20:00Z')), 600)
  assert.equal(elapsedSeconds({ ...value, completedAt: '2026-10-10T09:20:00Z' }), 600, 'finishing while paused does not count the final pause')
  value = togglePause(value, new Date('2026-10-10T09:20:00Z')); assert.equal(elapsedSeconds(value, Date.parse('2026-10-10T09:30:00Z')), 1200)
  value.duration.overrideSeconds = 777; assert.equal(elapsedSeconds(value, Date.parse('2026-10-10T12:00:00Z')), 777)
})
test('replacement keeps completed work on its original exercise and clears proposed values on replacement', () => {
  const value = session(); value.exercises[0].sets[0].completed = true; value.exercises[0].sets[0].completedAt = '2026-10-10T09:01:00Z'; value.exercises[0].sets.push({ id: 'pending', number: 2, lb: '120', weightKg: 54.4310844, rpe: '8', reps: '8', completed: false, completedAt: null, notes: 'Plan' })
  const row = { id: 'new-exercise', user_id: 'own', name: 'New movement', primary_muscle: 'Back', equipment: 'Cable', instructions: '', notes: '', weight_unit: 'lb', weight_increment: null, is_archived: false }
  const replaced = replaceSessionExercise(value, 0, row); assert.equal(replaced.exercises.length, 2); assert.equal(replaced.exercises[0].exerciseId, 'exercise'); assert.equal(replaced.exercises[0].sets.length, 1); assert.equal(replaced.exercises[1].exerciseId, row.id); assert.equal(replaced.exercises[1].sets[0].lb, ''); assert.equal(replaced.exercises[1].sets[0].reps, ''); assert.equal(replaced.exercises[1].sets[0].completed, false); assert.notEqual(replaced.exercises[1].sets[0].id, 'pending')
  assert.equal(replaced.exercises[1].sets[0].weightKg ?? null, null); assert.equal(replaced.exercises[1].sets[0].rpe ?? '', '')
})
test('grouping changes only selected exercise metadata and leaves logged sets untouched', () => {
  const first = session().exercises[0], second = { ...first, id: 'second' }, third = { ...first, id: 'third' }, result = groupExercises([first, second, third], [0, 1], 'superset')
  assert.equal(result[0].group.id, result[1].group.id); assert.equal(result[2].group, undefined); assert.deepEqual(result[0].sets, first.sets); assert.throws(() => groupExercises([first], [0], 'superset'), /2 exercises/)
  assert.throws(() => groupExercises([first, second], [0, 0], 'superset'))
  assert.throws(() => groupExercises([first, second], [0, 3], 'superset'))
})
