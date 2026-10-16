import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const bundle = await build({ entryPoints: ['src/data/workoutStore.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',plugins:[{name:'isolated-client',setup(b){b.onResolve({filter:/(?:^|\/)supabase$/},()=>({path:'mock',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase={};'}))}}] })
const module = { exports: {} }; new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
const { WorkoutDatabase, createWorkoutStore } = module.exports
const session = (userId = 'own') => ({ id: 'workout', userId, name: 'Push A', date: '2026-10-10', startedAt: '2026-10-10T09:00:00Z', completedAt: null, revision: 0, exercises: [] })
async function fixture(t) { const db = new WorkoutDatabase(`arc-fit-test-${crypto.randomUUID()}`); await db.open(); t.after(async () => { db.close(); await db.delete() }); return { db, store: createWorkoutStore(db) } }
test('IndexedDB reopens persisted owner-scoped sessions and frozen pending operation', async t => {
  const { db, store } = await fixture(t); await store.record(session()); await store.record({ ...session('other'), name: 'Other account' }); const operation = (await db.outbox.where('userId').equals('own').first()).operationId
  db.close(); await db.open(); const reopened = createWorkoutStore(db)
  assert.equal((await reopened.get('own', 'workout')).session.name, 'Push A'); assert.equal((await reopened.list('own')).length, 1); assert.equal(await reopened.get('third', 'workout'), null)
  assert.equal((await db.outbox.where('userId').equals('own').first()).operationId, operation)
})
test('local aggregate and outbox changes roll back together when quota/storage write fails', async t => {
  const { db, store } = await fixture(t); await store.record(session()); await db.outbox.clear(); const add = db.outbox.add.bind(db.outbox); db.outbox.add = async () => { throw Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' }) }
  await assert.rejects(store.record({ ...session(), name: 'Unsaved change' }), /Quota/); db.outbox.add = add
  assert.equal((await store.get('own', 'workout')).session.name, 'Push A'); assert.equal(await store.pending('own'), 0)
})
test('ambiguous accepted write replays exactly the frozen UUID and payload on retry', async t => {
  const { store } = await fixture(t); await store.record(session()); const calls = []; let first = true
  const write = async (payload, id, revision) => { calls.push({ payload: structuredClone(payload), id, revision }); if (first) { first = false; throw new Error('Response lost after commit') } return { revision: 1 } }
  await assert.rejects(store.flush('own', write, async () => session()), /Response lost/); assert.equal(await store.pending('own'), 1)
  await store.flush('own', write, async () => session()); assert.equal(await store.pending('own'), 0); assert.deepEqual(calls[0], calls[1]); assert.equal((await store.get('own', 'workout')).revision, 1)
})
test('flush drains a newer concurrent edit after the first frozen receipt', async t => {
  const { store } = await fixture(t); await store.record(session()); const calls = []
  await store.flush('own', async (value, id, revision) => { calls.push({ name: value.name, id, revision }); if (calls.length === 1) await store.record({ ...session(), name: 'Edited while saving' }); return { revision: revision + 1 } }, async () => session())
  assert.equal(calls.length, 2); assert.equal(calls[0].name, 'Push A'); assert.equal(calls[1].name, 'Edited while saving'); assert.notEqual(calls[0].id, calls[1].id); assert.equal(calls[1].revision, 1); assert.equal(await store.pending('own'), 0)
})
for (const finished of [false, true]) test(`revision conflict preserves both versions and local resolution uses ${finished ? 'edit' : 'save'} against server`, async t => {
  const { db, store } = await fixture(t); const local = { ...session(), name: 'Local changes', completedAt: '2026-10-10T10:00:00Z' }, server = { ...session(), name: 'Server changes', revision: 4, completedAt: finished ? '2026-10-10T10:01:00Z' : null }
  await store.record(local); await assert.rejects(store.flush('own', async () => { throw Object.assign(new Error('Conflict'), { code: '40001' }) }, async () => server), /Conflict/)
  const conflict = await store.get('own', 'workout'); assert.equal(conflict.session.name, local.name); assert.equal(conflict.conflict.name, server.name)
  await store.resolve('own', 'workout', 'local'); const pending = await db.outbox.toArray(); assert.equal(pending.length, 1); assert.equal(pending[0].action, finished ? 'edit' : 'save'); assert.equal(pending[0].revision, 4); assert.equal((await store.get('own', 'workout')).conflict, undefined)
})
test('server resolution removes stale pending edits without another write', async t => {
  const { store } = await fixture(t); await store.record(session()); await assert.rejects(store.flush('own', async () => { throw Object.assign(new Error('Conflict'), { code: '40001' }) }, async () => ({ ...session(), revision: 2, name: 'Server copy' })))
  await store.resolve('own', 'workout', 'server'); assert.equal(await store.pending('own'), 0); assert.equal((await store.get('own', 'workout')).session.name, 'Server copy')
})
test('editor leases reject a second tab and prevent stale-token edits after takeover', async t => {
  const { store } = await fixture(t); const now = Date.now(); assert.equal(await store.claim('own', 'workout', 'first', now), true); assert.equal(await store.claim('own', 'workout', 'second', now + 1), false)
  await store.record(session(), 'save', 'first'); assert.equal(await store.claim('own', 'workout', 'second', now + 15001), true)
  await assert.rejects(store.record({ ...session(), name: 'Stale tab' }, 'save', 'first'), /another tab/); assert.equal((await store.get('own', 'workout')).session.name, 'Push A')
  await store.release('own', 'workout', 'first'); assert.equal(await store.claim('own', 'workout', 'third', now + 15002), false)
})
test('parallel sync callers do not invent a newer edit after the same idempotent receipt', async t => {
  const { store } = await fixture(t); await store.record(session()); let calls = 0; let unblock; const barrier = new Promise(resolve => { unblock = resolve })
  const write = async (_value, _id, revision) => { calls++; if (calls === 1) await new Promise(resolve => setTimeout(resolve, 10)); unblock(); await barrier; return { revision: revision + 1 } }
  await Promise.all([store.flush('own', write, async () => session()), store.flush('own', write, async () => session())])
  assert.equal(await store.pending('own'), 0); assert.equal((await store.get('own', 'workout')).revision, 1)
})
