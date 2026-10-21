import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto'
import { readFile, readdir, writeFile, access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, execFileSync } from 'node:child_process'
import { validatePreviewEnvironment, verifyPreviewOutput } from './build-develop-preview.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contractPath = path.join(root, 'android-release-contract.json')
export const sha256 = value => createHash('sha256').update(value).digest('hex')
export function validateOtaPublicKey(value) {
  const pem = value.replace(/\\n/g, '\n').trim()
  if (!pem.startsWith('-----BEGIN RSA PUBLIC KEY-----')) throw new Error('Updater 8.53.1 requires a PKCS#1 RSA PUBLIC KEY PEM')
  let key
  try { key = createPublicKey(pem) } catch { throw new Error('OTA public key is invalid') }
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength !== 2048) throw new Error('Updater 8.53.1 requires an RSA-2048 signing key')
  return { pem, key, fingerprint: sha256(key.export({ type: 'spki', format: 'der' })) }
}
export async function readContract() { return JSON.parse(await readFile(contractPath, 'utf8')) }
export function assertDevelopBranch() {
  let branch
  try { branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { throw new Error('Development Android releases require a verified develop checkout') }
  if (branch !== 'develop') throw new Error('Development Android releases require the develop branch')
}
export function frontendEnvironment(publicValues, inherited = process.env) {
  const env = { ...inherited, ...publicValues, BRANCH: 'develop' }
  for (const name of Object.keys(env)) if (/^(?:SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY|SERVICE_KEY)|CAPGO_TOKEN|CAPGO_PRIVATE_KEY|ARC_ANDROID_(?:KEYSTORE_PATH|KEYSTORE_PASSWORD|KEY_ALIAS|KEY_PASSWORD))$/.test(name)) delete env[name]
  validatePreviewEnvironment(env)
  return env
}
const ignoredDirectories = new Set(['build', '.gradle', '.gradle-cache', '.toolchain', '.idea', 'node_modules', '.cxx'])
async function treeFiles(relative) {
  let entries
  try { entries = await readdir(path.join(root, relative), { withFileTypes: true }) }
  catch (error) { if (error.code === 'ENOENT') throw new Error(`Required native/schema directory is missing: ${relative}`); throw error }
  const found = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Release baseline does not allow symbolic links: ${relative}/${entry.name}`)
    if (ignoredDirectories.has(entry.name) || entry.name === 'local.properties' || /\.(?:jks|keystore)$/.test(entry.name)) continue
    const name = `${relative}/${entry.name}`
    if (name === 'android/capacitor-cordova-android-plugins' || name === 'android/app/src/main/res/xml/config.xml' || name.endsWith('_PROPOSAL.sql')) continue
    // Web assets are replaced by OTA; generated config includes build environment values.
    if (name.startsWith('android/app/src/main/assets/')) continue
    if (entry.isDirectory()) found.push(...await treeFiles(name))
    else if (entry.isFile()) found.push(name)
  }
  return found
}
export async function computeNativeBaseline() {
  const contract = await readContract()
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
  const nativePackages = {}
  for (const [name, value] of Object.entries(lock.packages ?? {})) {
    if (!name.startsWith('node_modules/')) continue
    const packageName = name.slice('node_modules/'.length)
    const native = packageName.startsWith('@capacitor/') || packageName.startsWith('@capgo/') || packageName.startsWith('cordova-')
    if (native) nativePackages[packageName] = { version: value.version, integrity: value.integrity ?? null }
  }
  for (const name of ['@capacitor/core', '@capacitor/android', '@capacitor/cli', '@capgo/capacitor-updater']) {
    if (!nativePackages[name]) throw new Error(`Required pinned native package is missing from lockfile: ${name}`)
    const declared = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]
    if (declared !== nativePackages[name].version) throw new Error(`Native dependency must be pinned exactly: ${name}`)
  }
  const files = [...new Set([...contract.baselineFiles, ...(await Promise.all(contract.baselineTrees.map(treeFiles))).flat()])].sort()
  const digests = {}
  for (const file of files) {
    const resolved = path.resolve(root, file)
    if (!resolved.startsWith(root + path.sep)) throw new Error('Baseline file escaped repository')
    // Normalize checkout line endings, keeping binary files exact.
    const bytes = await readFile(resolved)
    digests[file] = sha256(/\.(?:jar|png|webp|ico)$/.test(file) ? bytes : bytes.toString('utf8').replace(/\r\n/g, '\n'))
  }
  // Hash the full dependency lock as well: plugins can use arbitrary package names.
  // This intentionally blocks even pure-JS dependency bumps until native review.
  const dependencyLockHash = sha256(JSON.stringify(lock))
  const declaredDependencies = { dependencies: pkg.dependencies ?? {}, devDependencies: pkg.devDependencies ?? {}, optionalDependencies: pkg.optionalDependencies ?? {} }
  const header = { contractId: contract.contractId, applicationId: contract.applicationId, nativeVersion: contract.nativeVersion, nativeVersionCode: contract.nativeVersionCode, publicKeySha256: contract.publicKeySha256, dependencyLockHash, declaredDependencies, nativePackages: Object.fromEntries(Object.entries(nativePackages).sort()), files: digests }
  return { hash: sha256(JSON.stringify(header)), files, nativePackages }
}
export async function verifyBaseline() {
  const contract = await readContract()
  const baseline = await computeNativeBaseline()
  if (!/^[a-f0-9]{64}$/.test(contract.expectedBaselineHash ?? '') || contract.expectedBaselineHash !== baseline.hash) throw new Error('Native/storage baseline is unrecorded or changed. Build and distribute a reviewed new APK before publishing OTA.')
  const gradle = await readFile(path.join(root, 'android/app/build.gradle'), 'utf8')
  const config = await readFile(path.join(root, 'capacitor.config.ts'), 'utf8')
  if (gradle.match(/applicationId\s*(?:=\s*)?["']([^"']+)["']/)?.[1] !== contract.applicationId || config.match(/appId\s*:\s*["']([^"']+)["']/)?.[1] !== contract.applicationId || gradle.match(/versionName\s*(?:=\s*)?["']([^"']+)["']/)?.[1] !== contract.nativeVersion || Number(gradle.match(/versionCode\s*(?:=\s*)?(\d+)/)?.[1]) !== contract.nativeVersionCode) throw new Error('Native application ID/version does not match the reviewed release contract')
  return { contract, ...baseline }
}
function runNode(relative, args = [], env = process.env) {
  const result = spawnSync(process.execPath, [path.join(root, relative), ...args], { cwd: root, env, stdio: 'inherit' })
  if (result.error || result.status !== 0) throw new Error(`Release command failed: ${relative}`)
}
export async function buildNative() {
  assertDevelopBranch()
  const baseline = await verifyBaseline()
  const version = process.env.ARC_WEB_BUNDLE_VERSION ?? '1.0.0'
  if (!/^1\.0\.(0|[1-9]\d*)(?:\+[a-f0-9]{64})?$/.test(version)) throw new Error('ARC_WEB_BUNDLE_VERSION must use 1.0.<run>+<native baseline SHA-256>')
  if (version.includes('+') && version.split('+')[1] !== baseline.hash) throw new Error('Web bundle namespace must match native baseline')
  if (baseline.contract.publicKeySha256 && !process.env.ARC_OTA_PUBLIC_KEY?.trim()) throw new Error('The reviewed native baseline requires its OTA public verification key')
  if (process.env.ARC_OTA_PUBLIC_KEY) {
    const { fingerprint } = validateOtaPublicKey(process.env.ARC_OTA_PUBLIC_KEY)
    if (fingerprint !== baseline.contract.publicKeySha256) throw new Error('OTA public key does not match the reviewed native baseline fingerprint')
  }
  // Vite loads only public-prefixed file values; non-VITE local service keys are never forwarded.
  const { loadEnv } = await import('vite')
  const publicValues = loadEnv('production', root, 'VITE_')
  const env = { ...frontendEnvironment(publicValues), ARC_NATIVE_BUILD: '1', ARC_NATIVE_BASELINE_SHA256: baseline.hash, ARC_WEB_BUNDLE_VERSION: version, ARC_OTA_CHANNEL: 'development' }
  runNode('node_modules/vite/bin/vite.js', ['build'], env)
  verifyPreviewOutput(path.join(root, 'dist'))
  runNode('node_modules/@capacitor/cli/bin/capacitor', ['sync', 'android'], env)
  const after = await computeNativeBaseline()
  if (after.hash !== baseline.hash) throw new Error('Native sync changed the reviewed baseline. Review changes and build a new native baseline; OTA is blocked.')
  return baseline
}
async function cli() {
  const command = process.argv[2]
  if (command === 'key-setup') {
    const directory = path.join(root, '.android-local', 'ota-signing')
    await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 })
    // Deliberately refuse an existing directory, including interrupted setup.
    await mkdir(directory, { mode: 0o700 })
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'pkcs1', format: 'pem' }, privateKeyEncoding: { type: 'pkcs1', format: 'pem' } })
    await writeFile(path.join(directory, 'private.pem'), pair.privateKey, { flag: 'wx', mode: 0o600 })
    await writeFile(path.join(directory, 'public.pem'), pair.publicKey, { flag: 'wx', mode: 0o600 })
    console.log(JSON.stringify({ publicKeySha256: validateOtaPublicKey(pair.publicKey).fingerprint, publicKeyPath: '.android-local/ota-signing/public.pem', privateKeyPath: '.android-local/ota-signing/private.pem' }))
  } else if (command === 'baseline') {
    const baseline = await computeNativeBaseline()
    if (process.argv.includes('--record')) {
      const contract = await readContract()
      contract.expectedBaselineHash = baseline.hash
      await writeFile(contractPath, JSON.stringify(contract, null, 2) + '\n')
    }
    console.log(baseline.hash)
  } else if (command === 'verify') console.log((await verifyBaseline()).hash)
  else if (command === 'build' || command === 'apk') {
    if (command === 'apk') {
      for (const name of ['ARC_ANDROID_KEYSTORE_PATH', 'ARC_ANDROID_KEYSTORE_PASSWORD', 'ARC_ANDROID_KEY_ALIAS', 'ARC_ANDROID_KEY_PASSWORD']) if (!process.env[name]) throw new Error(`Missing stable Android release signing setting: ${name}`)
      await access(process.env.ARC_ANDROID_KEYSTORE_PATH)
    }
    await buildNative()
    if (command === 'apk') {
      const windows = process.platform === 'win32'
      const result = spawnSync(windows ? 'cmd.exe' : './gradlew', windows ? ['/d', '/c', 'gradlew.bat assembleRelease --no-daemon'] : ['assembleRelease', '--no-daemon'], { cwd: path.join(root, 'android'), env: process.env, stdio: 'inherit' })
      if (result.error || result.status !== 0) throw new Error('Signed Android release build failed')
      await access(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'))
      console.log('Signed release APK: android/app/build/outputs/apk/release/app-release.apk')
    }
  } else throw new Error('Usage: node scripts/android-release.mjs key-setup | baseline [--record] | verify | build | apk')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli().catch(error => { console.error(error.message); process.exitCode = 1 })
