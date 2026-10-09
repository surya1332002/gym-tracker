import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

// Test control flow without network requests, credentials, or database writes.
const bundled = await build({
  entryPoints: ['src/lib/profiles.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'mock-authenticated-client', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'client', namespace: 'mock' }))
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
      contents: 'export const supabase = { auth: { getSession: () => globalThis.profileTestClient.auth.getSession() }, from: (...args) => globalThis.profileTestClient.from(...args) };',
    }))
  } }],
})
const { loadOrCreateProfile } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const userId = '11111111-1111-4111-8111-111111111111'
const defaults = { id: userId, display_name: null, timezone: 'America/Chicago', weight_unit: 'kg', distance_unit: 'km', created_at: '2026-10-08T12:00:00Z', updated_at: '2026-10-08T12:00:00Z' }

function mock({ reads = [{ data: defaults, error: null }], insertError = null, sessionId = userId } = {}) {
  const calls = { reads: 0, inserts: [] }
  globalThis.profileTestClient = {
    auth: { getSession: async () => ({ data: { session: sessionId ? { user: { id: sessionId } } : null }, error: null }) },
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select(columns) {
          assert.equal(columns, '*')
          return { eq(column, id) {
            assert.equal(column, 'id'); assert.equal(id, userId)
            return { maybeSingle: async () => reads[calls.reads++] }
          } }
        },
        async insert(payload) { calls.inserts.push(payload); return { error: insertError } },
      }
    },
  }
  return calls
}

test('loads existing preferences without writing', async () => {
  const profile = { ...defaults, timezone: 'Europe/London', weight_unit: 'lb', distance_unit: 'mi', display_name: 'Existing name' }
  const calls = mock({ reads: [{ data: profile, error: null }] })
  assert.deepEqual(await loadOrCreateProfile(userId), { profile, created: false })
  assert.deepEqual(calls.inserts, [])
})

test('inserts only UUID and reads back defaults; deduplicates simultaneous loads', async () => {
  const calls = mock({ reads: [{ data: null, error: null }, { data: defaults, error: null }] })
  const first = loadOrCreateProfile(userId)
  assert.equal(first, loadOrCreateProfile(userId))
  assert.deepEqual(await first, { profile: defaults, created: true })
  assert.deepEqual(calls.inserts, [{ id: userId }])
  assert.equal(calls.reads, 2)
})

test('never queries without the matching authenticated session', async () => {
  for (const sessionId of [null, 'different-user']) {
    const calls = mock({ sessionId })
    await assert.rejects(loadOrCreateProfile(userId), /matching authenticated session/)
    assert.equal(calls.reads, 0); assert.equal(calls.inserts.length, 0)
  }
})

test('preserves SELECT permission errors and does not insert after a failed read', async () => {
  const error = { code: '42501', message: 'permission denied for table profiles' }
  const calls = mock({ reads: [{ data: null, error }] })
  await assert.rejects(loadOrCreateProfile(userId), value => value === error)
  assert.equal(calls.inserts.length, 0)
})

test('surfaces INSERT RLS denial', async () => {
  const error = { code: '42501', message: 'new row violates row-level security policy' }
  mock({ reads: [{ data: null, error: null }], insertError: error })
  await assert.rejects(loadOrCreateProfile(userId), value => value === error)
})

test('handles another tab creating the row without overwriting it', async () => {
  mock({ reads: [{ data: null, error: null }, { data: defaults, error: null }], insertError: { code: '23505', message: 'duplicate key' } })
  assert.deepEqual(await loadOrCreateProfile(userId), { profile: defaults, created: false })
})

test('requires a readable profile after insert', async () => {
  mock({ reads: [{ data: null, error: null }, { data: null, error: null }] })
  await assert.rejects(loadOrCreateProfile(userId), /could not be read after creation/)
})
