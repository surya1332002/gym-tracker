import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
const hash = 'a'.repeat(64), version = `1.0.2+${hash}`
const release = { contractId: 'arc-fit-storage-1', nativeBaselineHash: hash, webVersion: '1.0.0', channel: 'development', otaEnabled: true }
const output = await build({ entryPoints: ['src/native/runtime.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
  define: { __ARC_NATIVE_RELEASE__: JSON.stringify(release) }, plugins: [{ name: 'native-bridge-fixture', setup(b) {
    b.onResolve({ filter: /^@(?:capacitor|capgo)\// }, args => ({ path: args.path, namespace: 'native' }))
    b.onLoad({ filter: /.*/, namespace: 'native' }, args => ({ contents: args.path === '@capacitor/core' ? 'export const Capacitor=globalThis.__nativeFixture.platform' : args.path === '@capacitor/app' ? 'export const App=globalThis.__nativeFixture.app' : 'export const CapacitorUpdater=globalThis.__nativeFixture.updater' }))
  } }] })
function fixture({ values = new Map(), latest = { version, url: 'https://trusted-provider.example/bundle.zip', sessionKey: 'encrypted-key', checksum: 'signed-checksum' }, downloaded = { id: 'bundle2', version, checksum: 'verified-sha256', status: 'pending' }, download, bundles = [], info } = {}) {
  const calls = { download: 0, set: 0, checks: 0, ready: 0 }
  let resume
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  globalThis.__nativeFixture = {
    platform: { isNativePlatform: () => true, getPlatform: () => 'android' },
    app: { getInfo: info ?? (async () => ({ version: '1.0.0', build: '1' })), addListener: async (_event, fn) => { resume = fn; return { remove() {} } } },
    updater: { current: async () => ({ bundle: { id: 'builtin', version: '1.0.0' } }), list: async () => ({ bundles }),
      getLatest: async () => { calls.checks++; return latest }, download: async options => { calls.download++; assert.equal(options.checksum, latest.checksum); if (download) return download(); return downloaded },
      set: async () => { calls.set++ }, notifyAppReady: async () => { calls.ready++ } },
  }
  const module = { exports: {} }
  new Function('module', 'exports', output.outputFiles[0].text)(module, module.exports)
  return { runtime: module.exports, calls, values, resume: () => resume({ isActive: true }) }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 5))
test('a native background download stages verified assets without reloading on completion or app resume', async () => {
  let finish
  const f = fixture({ download: () => new Promise(resolve => { finish = resolve }) })
  await f.runtime.initializeNativeRuntime()
  await settle()
  assert.equal(f.runtime.updateSnapshot().status, 'Downloading')
  finish({ id: 'bundle2', version, checksum: 'verified-sha256', status: 'pending' })
  await settle()
  assert.equal(f.runtime.updateSnapshot().status, 'Ready to apply')
  assert.equal(f.calls.set, 0)
  f.resume(); await settle()
  await f.runtime.activateStagedAtStartup(async () => true)
  assert.equal(f.calls.download, 1); assert.equal(f.calls.set, 0)
})
test('a verified prior-launch bundle activates once only after eligibility, retaining unrelated private storage', async () => {
  const values = new Map([['private-encrypted-workout', 'unchanged'], ['arc-fit-native-staged-v1', JSON.stringify({ id: 'bundle2', version, checksum: 'verified-sha256', baseline: hash })]])
  const f = fixture({ values, latest: { version: '1.0.0' }, bundles: [{ id: 'bundle2', version, checksum: 'verified-sha256', status: 'pending' }] })
  await Promise.all([f.runtime.activateStagedAtStartup(async () => true), f.runtime.activateStagedAtStartup(async () => true)])
  assert.equal(f.calls.set, 1)
  assert.equal(values.get('private-encrypted-workout'), 'unchanged')
  assert.equal(values.has('arc-fit-native-staged-v1'), false)
})
test('unverified, plaintext, incompatible and insecure update metadata cannot start a download', async () => {
  for (const change of [{ sessionKey: '' }, { checksum: '' }, { breaking: true }, { major: true }, { version: `1.0.3+${'b'.repeat(64)}` }, { url: 'http://provider.example/bundle.zip' }, { manifest: [] }]) {
    const f = fixture({ latest: { version, url: 'https://trusted-provider.example/bundle.zip', sessionKey: 'encrypted', checksum: 'signed', ...change } })
    await f.runtime.initializeNativeRuntime(); await settle()
    assert.equal(f.calls.download, 0); assert.equal(f.calls.set, 0)
    assert.equal(f.runtime.updateSnapshot().status, 'Update failed')
  }
})
test('signature/download failure preserves existing data and never stages an update', async () => {
  const values = new Map([['private-encrypted-workout', 'unchanged']])
  const f = fixture({ values, download: async () => { throw new Error('Native signature verification rejected payload') } })
  await f.runtime.initializeNativeRuntime(); await settle()
  assert.equal(f.runtime.updateSnapshot().status, 'Update failed')
  assert.equal(values.get('private-encrypted-workout'), 'unchanged')
  assert.equal(values.has('arc-fit-native-staged-v1'), false)
  assert.equal(f.calls.set, 0)
})
test('active workout safety or native rollback error prevents staged bundle activation', async () => {
  for (const status of ['pending', 'error']) {
    const f = fixture({ values: new Map([['arc-fit-native-staged-v1', JSON.stringify({ id: 'bundle2', version, checksum: 'verified-sha256', baseline: hash })]]), latest: { version: '1.0.0' }, bundles: [{ id: 'bundle2', version, checksum: 'verified-sha256', status }] })
    await f.runtime.activateStagedAtStartup(async () => false)
    assert.equal(f.calls.set, 0)
  }
})
