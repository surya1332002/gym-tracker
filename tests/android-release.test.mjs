import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateKeyPairSync, createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { validateOtaPublicKey, frontendEnvironment } from '../scripts/android-release.mjs'

const originalGradle = 'applicationId "com.arcfit.app"\nversionName "1.0.0"\nversionCode 1\n'
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'arc-release-test-'))
  t.after(async () => {
    assert.ok(directory.startsWith(path.join(tmpdir(), 'arc-release-test-')))
    await rm(directory, { recursive: true, force: true })
  })
  const put = (file, value) => writeFile(path.join(directory, file), value)
  for (const folder of ['scripts', 'android/app', 'docs/migrations', 'dist']) await mkdir(path.join(directory, folder), { recursive: true })
  for (const name of ['android-release.mjs', 'publish-android-ota.mjs', 'build-develop-preview.mjs']) await put('scripts/' + name, await readFile(new URL('../scripts/' + name, import.meta.url)))
  const packages = ['@capacitor/core', '@capacitor/android', '@capacitor/cli', '@capgo/capacitor-updater']
  const pkg = { dependencies: Object.fromEntries(packages.map(name => [name, '8.0.0'])) }
  const lock = { packages: Object.fromEntries(packages.map(name => ['node_modules/' + name, { version: '8.0.0', integrity: 'fixture' }])) }
  const contract = { contractId: 'arc-fit-storage-1', applicationId: 'com.arcfit.app', nativeVersion: '1.0.0', nativeVersionCode: 1, publicKeySha256: null, expectedBaselineHash: null, baselineFiles: ['capacitor.config.ts'], baselineTrees: ['android', 'docs/migrations'] }
  const saveContract = () => put('android-release-contract.json', JSON.stringify(contract))
  await put('package.json', JSON.stringify(pkg)); await put('package-lock.json', JSON.stringify(lock))
  await put('capacitor.config.ts', "appId: 'com.arcfit.app'\n")
  await put('android/app/build.gradle', originalGradle)
  await put('docs/migrations/1.sql', 'create table fixture;\n')
  await saveContract()
  const api = await import(pathToFileURL(path.join(directory, 'scripts/android-release.mjs')))
  const record = async () => { contract.expectedBaselineHash = (await api.computeNativeBaseline()).hash; await saveContract(); return contract.expectedBaselineHash }
  return { directory, put, contract, pkg, lock, saveContract, record, ...api }
}
function execute(directory, script, args = [], extraEnv = {}) {
  const env = { ...process.env }
  for (const key of ['CAPGO_TOKEN', 'CAPGO_PRIVATE_KEY', 'ARC_OTA_PUBLIC_KEY', 'ARC_NATIVE_BASELINE_SHA256', 'ARC_WEB_BUNDLE_VERSION', 'ARC_OTA_CHANNEL', 'ARC_ANDROID_APP_ID']) delete env[key]
  return spawnSync(process.execPath, [path.join(directory, 'scripts', script), ...args], { cwd: directory, env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 10000 })
}
test('native baseline requires explicit recording and is stable across checkout line endings', async t => {
  const f = await fixture(t)
  await assert.rejects(f.verifyBaseline, /unrecorded or changed/)
  const hash = await f.record()
  assert.equal((await f.verifyBaseline()).hash, hash)
  await f.put('android/app/build.gradle', originalGradle.replace(/\n/g, '\r\n'))
  assert.equal((await f.verifyBaseline()).hash, hash)
})
test('native file, migration additions, arbitrary dependency and public key changes block OTA baseline', async t => {
  const f = await fixture(t)
  await f.record()
  await f.put('android/app/build.gradle', originalGradle + '// changed native code')
  await assert.rejects(f.verifyBaseline, /unrecorded or changed/)
  await f.put('android/app/build.gradle', originalGradle)
  await f.put('docs/migrations/2.sql', 'alter table fixture;')
  await assert.rejects(f.verifyBaseline, /unrecorded or changed/)
  await rm(path.join(f.directory, 'docs/migrations/2.sql'))
  f.lock.packages['node_modules/arbitrary-native-plugin'] = { version: '1.0.0' }
  await f.put('package-lock.json', JSON.stringify(f.lock))
  await assert.rejects(f.verifyBaseline, /unrecorded or changed/)
  delete f.lock.packages['node_modules/arbitrary-native-plugin']
  await f.put('package-lock.json', JSON.stringify(f.lock))
  f.contract.publicKeySha256 = 'a'.repeat(64); await f.saveContract()
  await assert.rejects(f.verifyBaseline, /unrecorded or changed/)
})
test('recording a baseline cannot disguise mismatched native application identity/version', async t => {
  const f = await fixture(t)
  await f.put('android/app/build.gradle', originalGradle.replace('1.0.0', '2.0.0'))
  await f.record()
  await assert.rejects(f.verifyBaseline, /application ID\/version/)
})
test('unpinned required native dependencies fail before baseline recording', async t => {
  const f = await fixture(t)
  f.pkg.dependencies['@capacitor/core'] = '^8.0.0'
  await f.put('package.json', JSON.stringify(f.pkg))
  await assert.rejects(f.computeNativeBaseline, /pinned exactly/)
})
test('generated Cordova files and unapplied SQL proposals do not change the checkout baseline', async t => {
  const f = await fixture(t)
  const hash = await f.record()
  await mkdir(path.join(f.directory, 'android/capacitor-cordova-android-plugins'), { recursive: true })
  await mkdir(path.join(f.directory, 'android/app/src/main/res/xml'), { recursive: true })
  await f.put('android/capacitor-cordova-android-plugins/generated.gradle', 'generated content')
  await f.put('android/app/src/main/res/xml/config.xml', '<generated />')
  await f.put('docs/migrations/change_PROPOSAL.sql', 'unapproved proposal')
  assert.equal((await f.verifyBaseline()).hash, hash)
})
test('Android updater key guard accepts PKCS1 RSA2048 and rejects SPKI and other RSA sizes', () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = pair.publicKey.export({ type: 'pkcs1', format: 'pem' })
  const verified = validateOtaPublicKey(pem)
  const expected = createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
  assert.equal(verified.fingerprint, expected)
  assert.equal(validateOtaPublicKey(pem.replace(/\n/g, '\\n')).fingerprint, expected)
  assert.throws(() => validateOtaPublicKey(pair.publicKey.export({ type: 'spki', format: 'pem' })), /PKCS#1/)
  const small = generateKeyPairSync('rsa', { modulusLength: 1024 })
  assert.throws(() => validateOtaPublicKey(small.publicKey.export({ type: 'pkcs1', format: 'pem' })), /RSA-2048/)
})
test('key setup prints no private material and refuses overwriting an existing key directory', async t => {
  const f = await fixture(t)
  const first = execute(f.directory, 'android-release.mjs', ['key-setup'])
  assert.equal(first.status, 0, first.stderr)
  assert.doesNotMatch(first.stdout, /BEGIN|PRIVATE KEY|MII/)
  assert.match(JSON.parse(first.stdout).publicKeySha256, /^[a-f0-9]{64}$/)
  const keyPath = path.join(f.directory, '.android-local/ota-signing/private.pem')
  const before = await readFile(keyPath)
  const second = execute(f.directory, 'android-release.mjs', ['key-setup'])
  assert.notEqual(second.status, 0)
  assert.deepEqual(await readFile(keyPath), before)
})
test('publisher exits on missing credentials without invoking a provider command', async t => {
  const f = await fixture(t)
  const result = execute(f.directory, 'publish-android-ota.mjs', [], { PATH: '' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing CAPGO_TOKEN/)
})
test('native frontend validation strips nonpublic process secrets and rejects private VITE variables', () => {
  const publicConfig = { VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' }
  const env = frontendEnvironment(publicConfig, { SUPABASE_SECRET_KEY: 'local-server-secret', CAPGO_PRIVATE_KEY: 'private-fixture', ARC_ANDROID_KEY_PASSWORD: 'password-fixture' })
  assert.equal(env.SUPABASE_SECRET_KEY, undefined)
  assert.equal(env.CAPGO_PRIVATE_KEY, undefined)
  assert.equal(env.ARC_ANDROID_KEY_PASSWORD, undefined)
  assert.equal(env.VITE_SUPABASE_PUBLISHABLE_KEY, publicConfig.VITE_SUPABASE_PUBLISHABLE_KEY)
  assert.throws(() => frontendEnvironment({ ...publicConfig, VITE_PRIVATE_KEY: 'private-fixture' }, {}), /Disallowed private frontend variable/)
  assert.throws(() => frontendEnvironment({ ...publicConfig, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fixture' }, {}), /Disallowed private frontend variable/)
})
