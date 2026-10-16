import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const output = await build({ stdin: { contents: "export * from './src/data/startCache'; export * from './src/data/vault'; export * from './src/data/workoutStore';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', output.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { StartDatabase, createStartCache, createVault, makeCachedSession, WorkoutDatabase, createWorkoutStore } = module.exports
const owner = '11111111-1111-4111-8111-111111111111', exerciseId = '22222222-2222-4222-8222-222222222222', programmeId = '33333333-3333-4333-8333-333333333333', dayId = '44444444-4444-4444-8444-444444444444'
function values(smartPrefill = false) {
  const personal = [{ id: exerciseId, user_id: owner, name: 'Private press', primary_muscle: 'Chest', equipment: 'Dumbbells', instructions: 'Recorded guidance', notes: 'Seat 4; per side', weight_unit: 'lb', weight_increment: 2.5, is_archived: false, last_machine_preset_id: 'last-preset' }]
  const programme = { id: programmeId, user_id: owner, name: 'Personal routine', split: 'Custom', muscles: [], revision: 7 }
  const previous = [{ exercise_id: exerciseId, routine_day_id: dayId, performance_date: null, recorded_sets: [{ number: 1, weight_lb: 75.125, reps: 9 }], source_key: 'fixture', source_fields: {}, machine_settings: '', per_side_qualifiers: '', original_notes: '' }]
  return { library: { userId: owner, programmes: [programme], personal, settings: [{ id: 'old-preset', user_id: owner, exercise_id: exerciseId, label: 'Old machine' }, { id: 'last-preset', user_id: owner, exercise_id: exerciseId, label: 'Actual last machine', seat_position: '4' }], previous, smartPrefill }, bundle: { userId: owner, programme, days: [{ id: dayId, user_id: owner, programme_id: programmeId, programme_revision: 7, name: 'Push A', sequence_number: 1 }], draft: { name: programme.name, split: 'Custom', muscles: [], days: [{ name: 'Push A', exercises: [{ exerciseId, name: 'Private press', sets: null, min: null, max: null, startingWeightLb: '' }] }] } } }
}
async function fixture(t) {
  const storageValues = new Map(), storage = { getItem: key => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value), removeItem: key => storageValues.delete(key) }; let keyRow = null
  const query = { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: keyRow, error: null }), insert: async value => { keyRow = value; return { error: null } } }, client = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }), getSession: async () => ({ data: { session: { user: { id: owner } } }, error: null }) }, from: () => query }
  const vault = createVault({ client, storage }); await vault.ensureOnline(owner)
  const db = new StartDatabase(`start-test-${crypto.randomUUID()}`), workoutDb = new WorkoutDatabase(`start-workout-test-${crypto.randomUUID()}`); await db.open(); await workoutDb.open(); t.after(async () => { vault.lock(); db.close(); workoutDb.close(); await db.delete(); await workoutDb.delete() })
  return { vault, db, cache: createStartCache(db, vault), workoutDb, store: createWorkoutStore(workoutDb, vault) }
}
test('encrypted cached programme reopens offline with exact blank targets, notes and actual last preset', async t => {
  const { db, cache, vault } = await fixture(t), data = values(); await cache.saveLibrary(data.library); await cache.saveProgramme(data.bundle)
  const raw = JSON.stringify(await db.caches.toArray()); assert.ok(!raw.includes('Private press')); assert.ok(!raw.includes('Seat 4')); assert.ok(!raw.includes('75.125')); assert.ok(await cache.hasPrivateData(owner))
  db.close(); await db.open(); const reopened = createStartCache(db, vault), library = await reopened.library(owner), bundle = await reopened.programme(owner, programmeId), session = makeCachedSession(library, bundle, 0)
  assert.equal(session.dayId, dayId); assert.equal(session.exercises[0].sets.length, 0); assert.equal(session.exercises[0].min, null); assert.equal(session.exercises[0].max, null); assert.equal(session.exercises[0].startingWeightLb, ''); assert.equal(session.exercises[0].notes, 'Seat 4; per side'); assert.equal(session.exercises[0].settings.length, 1); assert.equal(session.exercises[0].settings[0].id, 'last-preset')
  assert.equal(await reopened.library('other-account'), null)
})
test('smart prefill follows captured preference and never completes actual planned sets', () => {
  const data = values(false); data.bundle.draft.days[0].exercises[0].sets = 1
  const disabled = makeCachedSession(data.library, data.bundle, 0); assert.equal(disabled.exercises[0].sets[0].lb, ''); assert.equal(disabled.exercises[0].sets[0].reps, '')
  data.library.smartPrefill = true; const enabled = makeCachedSession(data.library, data.bundle, 0); assert.equal(enabled.exercises[0].sets[0].lb, '75.125'); assert.equal(enabled.exercises[0].sets[0].reps, '9'); assert.equal(enabled.exercises[0].sets[0].completed, false); assert.equal(enabled.completedAt, null)
})
test('cached start persists encrypted active session and outbox atomically without online save and retries same identity', async t => {
  const { store, workoutDb } = await fixture(t), data = values(), value = makeCachedSession(data.library, data.bundle, 0)
  await store.start(value); const retried = await store.start({ ...value, name: 'An accidental retry change' }); assert.equal(retried.name, value.name); assert.equal((await store.list(owner)).length, 1); assert.equal(await store.pending(owner), 1)
  const raw = JSON.stringify(await workoutDb.workouts.toArray()) + JSON.stringify(await workoutDb.outbox.toArray()); assert.ok(!raw.includes('Private press')); assert.ok(!raw.includes('Seat 4'))
  await assert.rejects(store.start(makeCachedSession(data.library, data.bundle, 0)), /unfinished/)
  assert.equal((await store.list(owner)).length, 1)
})
test('parallel cached starts cannot create two active sessions', async t => {
  const { store } = await fixture(t), data = values(); const outcomes = await Promise.allSettled([store.start(makeCachedSession(data.library, data.bundle, 0)), store.start(makeCachedSession(data.library, data.bundle, 0))])
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1); assert.equal((await store.list(owner)).length, 1); assert.equal(await store.pending(owner), 1)
})
test('tampered/locked start records fail closed without replacing cached ciphertext', async t => {
  const { cache, db, vault } = await fixture(t), data = values(); await cache.saveLibrary(data.library); const [raw] = await db.caches.toArray(); await db.caches.put({ ...raw, blob: { ...raw.blob, ciphertext: raw.blob.ciphertext.slice(0, -4) + 'AAAA' } })
  await assert.rejects(cache.library(owner), /could not be verified/); assert.equal(await cache.hasPrivateData(owner), true); vault.lock(); await assert.rejects(cache.library(owner), /Unlock/); assert.equal(await db.caches.count(), 1)
})
test('random starts preserve chosen movement order and no planned sets, and reject foreign day/exercise snapshots', () => {
  const data = values(); const value = makeCachedSession(data.library, null, null, data.library.personal); assert.equal(value.name, 'Random Workout'); assert.equal(value.dayId, null); assert.equal(value.exercises[0].exerciseId, exerciseId); assert.equal(value.exercises[0].sets.length, 0)
  data.bundle.days[0].user_id = 'foreign'; assert.throws(() => makeCachedSession(data.library, data.bundle, 0), /another account/)
  data.bundle.days[0].user_id = owner; data.library.personal[0].user_id = 'foreign'; assert.throws(() => makeCachedSession(data.library, data.bundle, 0), /this account/)
})
