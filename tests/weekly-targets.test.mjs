import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const bundle = await build({ stdin: { contents: "export * from './src/features/progress/weeklyTargets';export * from './src/features/progress/deletedWorkouts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { dateInZone, weekMonday, weekSummary, validateWeekTarget, createWeeklyTargetRepository, recoverableWorkouts, createDeletedWorkoutRepository, recoveryPeriodMs } = module.exports
test('week boundaries use the profile timezone rather than UTC or browser timezone', () => {
  const now = new Date('2026-10-12T00:30:00Z'); assert.equal(dateInZone(now, 'America/Chicago'), '2026-10-11'); assert.equal(weekMonday(dateInZone(now, 'America/Chicago')), '2026-10-05'); assert.equal(weekMonday(dateInZone(now, 'Asia/Kolkata')), '2026-10-12')
  assert.equal(weekMonday('2024-01-01'), '2024-01-01'); assert.throws(() => weekMonday('2026-02-31'), /valid date/)
})
test('historical targets remain unknown unless captured; rest weeks do not invent adherence', () => {
  const session = { id: 'a', date: '2026-10-06', startedAt: '2026-10-06T12:00:00Z', completedAt: '2026-10-06T13:00:00Z', exercises: [] }, sessions = [session, { ...session, id: 'planned', completedAt: null }, { ...session, id: 'deleted', deletedAt: '2026-10-07' }]
  assert.deepEqual(weekSummary(sessions, [], '2026-10-05', '2026-10-12', 6), { actual: 1, target: null, adherence: null, locked: true })
  assert.equal(weekSummary(sessions, [{ week_start: '2026-10-05', session_target: 2 }], '2026-10-05', '2026-10-12', 6).adherence, 50)
  assert.equal(weekSummary(sessions, [{ week_start: '2026-10-05', session_target: 0 }], '2026-10-05', '2026-10-12', 6).adherence, null)
  assert.equal(weekSummary([], [], '2026-10-12', '2026-10-12', 6).target, 6)
})
test('only current/future Mondays and integral targets within bounds are editable', () => {
  validateWeekTarget('2026-10-12', 0, '2026-10-12'); validateWeekTarget('2026-10-19', 14, '2026-10-12')
  for (const [week, target] of [['2026-10-05', 3], ['2026-10-13', 3], ['2026-10-12', -1], ['2026-10-12', 15], ['2026-10-12', 3.5]]) assert.throws(() => validateWeekTarget(week, target, '2026-10-12'))
})
test('Recently Deleted excludes unfinished, future deletion and expired records without deleting them', () => {
  const now = Date.parse('2026-10-10T12:00:00Z'), row = { id: 'valid', user_id: 'own', status: 'completed', completed_at: '2026-09-01', deleted_at: new Date(now - recoveryPeriodMs).toISOString() }
  const rows = [row, { ...row, id: 'expired', deleted_at: new Date(now - recoveryPeriodMs - 1).toISOString() }, { ...row, id: 'active', status: 'in_progress' }, { ...row, id: 'no-time', completed_at: null }, { ...row, id: 'future', deleted_at: new Date(now + 1).toISOString() }]
  assert.deepEqual(recoverableWorkouts(rows, now).map(r => r.id), ['valid']); assert.equal(rows.length, 5)
})
test('weekly repository rejects foreign reads and validates saved owner receipt', async () => {
  let owner = 'own', returnOwner = 'own', calls = 0
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: owner } } } }) }, from(table) { const q = { select() { return q }, eq() { return q }, order() { return q }, single() { return q }, then(resolve) { return Promise.resolve({ data: table === 'profiles' ? { id: returnOwner, timezone: 'UTC', weekly_target: 3 } : [{ user_id: returnOwner, week_start: '2026-10-12', session_target: 2 }], error: null }).then(resolve) } }; return q }, rpc: async (_name, args) => { calls++; return { data: { user_id: returnOwner, week_start: args.p_week_start, session_target: args.p_session_target } } } }
  const repo = createWeeklyTargetRepository(client); assert.equal((await repo.load('own')).normalTarget, 3); owner = 'other'; await assert.rejects(repo.load('own'), /matching/); owner = 'own'; returnOwner = 'foreign'; await assert.rejects(repo.load('own'), /another account/)
  const week = weekMonday(dateInZone(new Date(), 'UTC')); await assert.rejects(repo.save('own', week, 3, 'UTC'), /not confirmed/); assert.equal(calls, 1)
})
test('deleted-workout repository scopes owner and never performs a write', async () => {
  const calls = [], row = { id: 'valid', user_id: 'own', status: 'completed', completed_at: '2026-09-01', deleted_at: new Date().toISOString() }
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'own' } } } }) }, from(table) { calls.push(['from', table]); const q = {}; for (const method of ['select', 'eq', 'not', 'order', 'range']) q[method] = (...args) => { calls.push([method, ...args]); return q }; q.then = resolve => Promise.resolve({ data: [row], error: null }).then(resolve); return q } }
  const repo = createDeletedWorkoutRepository(client); assert.equal((await repo.list('own')).length, 1); assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'own')); assert.ok(!calls.some(call => ['insert', 'update', 'delete'].includes(call[0])))
})
