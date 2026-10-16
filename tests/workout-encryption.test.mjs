import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const output = await build({ stdin: { contents: "export * from './src/data/workoutStore';export * from './src/data/vault';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', output.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { WorkoutDatabase, createWorkoutStore, createVault } = module.exports
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const session = () => ({ id: 'workout', userId: owner, name: 'Synthetic private training', dayId: null, revision: 0, date: '2026-10-14', startedAt: '2026-10-14T09:00:00Z', completedAt: null, notes: 'Synthetic confidential note', exercises: [{ id: 'instance', exerciseId: 'exercise', name: 'Synthetic private press', notes: '', sets: [{ id: 'set', number: 1, lb: '135.1250000001', weightKg: 61.29168400324536, reps: '9', completed: false, completedAt: null, notes: 'Synthetic set note' }], settings: [{ seat_position: 'four' }], nextNumber: 2 }] })
async function fixture(t) {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; let keyRow = null
  const q = { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: keyRow, error: null }), insert: async value => { keyRow = value; return { error: null } } }, client = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }), getSession: async () => ({ data: { session: { user: { id: owner } } }, error: null }) }, from: () => q }
  const vault = createVault({ client, storage }); await vault.ensureOnline(owner); const db = new WorkoutDatabase(`encryption-test-${crypto.randomUUID()}`); await db.open()
  t.after(async () => { vault.lock(); db.close(); await db.delete() })
  return { db, vault, client, storage, store: createWorkoutStore(db, vault) }
}
function assertCiphertext(rows) { const raw = JSON.stringify(rows); for (const text of ['Synthetic private', 'Synthetic confidential', '135.1250000001', 'Synthetic set note']) assert.ok(!raw.includes(text), `Private synthetic value ${text} was stored unencrypted`); for (const row of rows) { assert.equal(row.session.version, 1); assert.ok(row.session.ciphertext); if (row.conflict && typeof row.conflict === 'object') { assert.equal(row.conflict.version, 1); assert.ok(row.conflict.ciphertext) } } }
test('workout/outbox/conflict are encrypted and precise values remain readable after database and device-key reload', async t => {
  const { db, store, vault, client, storage } = await fixture(t), local = session(), cloud = { ...session(), revision: 3, name: 'Synthetic private cloud training' }
  await store.record(local); await assert.rejects(store.flush(owner, async () => { throw Object.assign(new Error('Conflict'), { code: '40001' }) }, async () => cloud), /Conflict/)
  assertCiphertext(await db.workouts.toArray()); assertCiphertext(await db.outbox.toArray()); vault.lock(); db.close(); await db.open()
  const reloadedVault = createVault({ client, storage }); await reloadedVault.ensureOnline(owner); const reopened = createWorkoutStore(db, reloadedVault), row = await reopened.get(owner, local.id)
  assert.deepEqual(row.session, local); assert.deepEqual(row.conflict, cloud); assert.equal(await reopened.pending(owner), 1)
  await reopened.resolve(owner, local.id, 'server'); assert.deepEqual((await reopened.get(owner, local.id)).session, cloud); assert.equal(await reopened.pending(owner), 0); reloadedVault.lock()
})
test('locked or altered ciphertext fails closed without writes, plaintext fallback or discarded records', async t => {
  const { db, store, vault } = await fixture(t); await store.record(session()); vault.lock(); await assert.rejects(store.get(owner, 'workout'), /Unlock/); let writes = 0
  await assert.rejects(store.flush(owner, async () => { writes++; return { revision: 1 } }, async () => session()), /Unlock/); assert.equal(writes, 0); await vault.ensureOnline(owner)
  const [row] = await db.workouts.toArray(); await db.workouts.put({ ...row, session: { ...row.session, ciphertext: row.session.ciphertext.slice(0, -4) + 'AAAA' } }); await assert.rejects(store.get(owner, 'workout'), /could not be verified/); assert.equal(await db.workouts.count(), 1)
  const [pending] = await db.outbox.toArray(); await db.outbox.put({ ...pending, session: { ...pending.session, ciphertext: pending.session.ciphertext.slice(0, -4) + 'AAAA' } }); await assert.rejects(store.flush(owner, async () => { writes++; return { revision: 1 } }, async () => session()), /could not be verified/); assert.equal(writes, 0); assert.equal(await db.outbox.count(), 1)
})
test('encrypted records cannot be replayed under another account or different workout identity', async t => {
  const { db, store } = await fixture(t); await store.record(session()); const [row] = await db.workouts.toArray()
  await db.workouts.put({ ...row, key: `${owner}:another-workout`, id: 'another-workout' }); await assert.rejects(store.get(owner, 'another-workout'), /could not be verified/)
  await db.workouts.put({ ...row, key: `${other}:workout`, userId: other }); await assert.rejects(store.get(other, 'workout'), /Unlock/)
  assert.deepEqual((await store.get(owner, 'workout')).session, session())
})
test('legacy encryption migration preserves exact local, pending and conflict values without changing another account', async t => {
  const { db, store } = await fixture(t), local = session(), conflict = { ...session(), revision: 2, name: 'Synthetic private competing copy' }, raw = { key: `${owner}:workout`, userId: owner, id: 'workout', revision: 0, updatedAt: 123, session: local, conflict }, pending = { operationId: 'stable-operation', key: raw.key, userId: owner, revision: 0, session: local, action: 'save' }, foreign = { ...raw, key: `${other}:foreign`, userId: other, id: 'foreign', session: { ...local, userId: other }, conflict: undefined }
  await db.workouts.put(raw); await db.workouts.put(foreign); await db.outbox.put(pending); await store.encryptLegacy(owner)
  assert.deepEqual((await store.get(owner, 'workout')).session, local); assert.deepEqual((await store.get(owner, 'workout')).conflict, conflict); assertCiphertext(await db.workouts.where('userId').equals(owner).toArray()); assertCiphertext(await db.outbox.toArray()); assert.deepEqual(await db.workouts.get(foreign.key), foreign)
  const writes = []; await store.resolve(owner, 'workout', 'local'); await store.flush(owner, async (value, _operation, revision) => { writes.push({ value, revision }); return { revision: revision + 1 } }, async () => conflict); assert.equal(writes[0].value.exercises[0].sets[0].lb, '135.1250000001'); assert.equal(writes[0].revision, 2)
})
