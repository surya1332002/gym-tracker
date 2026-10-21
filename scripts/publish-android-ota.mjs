import { readFile, mkdtemp, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { verifyBaseline, validateOtaPublicKey, assertDevelopBranch } from './android-release.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
async function main() {
  // Check credentials before invoking any provider command or network operation.
  for (const name of ['CAPGO_TOKEN', 'CAPGO_PRIVATE_KEY', 'ARC_OTA_PUBLIC_KEY', 'ARC_NATIVE_BASELINE_SHA256', 'ARC_WEB_BUNDLE_VERSION']) if (!process.env[name]?.trim()) throw new Error(`OTA publication is blocked: missing ${name}`)
  assertDevelopBranch()
  if (process.env.ARC_OTA_CHANNEL !== 'development') throw new Error('Only the development OTA channel is authorized')
  const { contract, hash } = await verifyBaseline()
  if (hash !== process.env.ARC_NATIVE_BASELINE_SHA256) throw new Error('Source baseline does not match the independently supplied distributed APK baseline')
  if (!new RegExp(`^1\\.0\\.[1-9]\\d*\\+${hash}$`).test(process.env.ARC_WEB_BUNDLE_VERSION)) throw new Error('OTA version must be 1.0.<positive run number>+<native baseline SHA-256>')
  let publicDer, privatePublicDer
  const verifiedKey = validateOtaPublicKey(process.env.ARC_OTA_PUBLIC_KEY)
  try {
    publicDer = verifiedKey.key.export({ type: 'spki', format: 'der' })
    privatePublicDer = createPublicKey(createPrivateKey(process.env.CAPGO_PRIVATE_KEY.replace(/\\n/g, '\n'))).export({ type: 'spki', format: 'der' })
  } catch { throw new Error('OTA signing key material could not be parsed') }
  if (!publicDer.equals(privatePublicDer) || verifiedKey.fingerprint !== contract.publicKeySha256) throw new Error('Signing keys do not match the public key fingerprint in the shipped native baseline')
  const release = JSON.parse(await readFile(path.join(root, 'dist/native-release.json'), 'utf8'))
  if (release.contractId !== contract.contractId || release.nativeBaselineHash !== hash || release.webVersion !== process.env.ARC_WEB_BUNDLE_VERSION || release.channel !== 'development' || release.otaEnabled !== true) throw new Error('Built native release metadata does not match this OTA publication')
  const appId = process.env.ARC_ANDROID_APP_ID
  if (!appId || appId !== contract.applicationId) throw new Error('ARC_ANDROID_APP_ID must match the configured development native application ID')
  const temporary = await mkdtemp(path.join(tmpdir(), 'arc-fit-ota-'))
  try {
    const keyPath = path.join(temporary, 'signing-key.pem')
    await writeFile(keyPath, process.env.CAPGO_PRIVATE_KEY.replace(/\\n/g, '\n'), { mode: 0o600 })
    const args = ['--yes', '@capgo/cli@8.90.1', 'bundle', 'upload', appId, '--channel', 'development', '--path', 'dist', '--bundle', process.env.ARC_WEB_BUNDLE_VERSION, '--min-update-version', contract.nativeVersion, '--fail-on-incompatible', '--no-delta', '--key-v2', keyPath]
    // Avoid shell interpolation and secret command-line arguments on every platform.
    const windowsNpx = process.env.npm_execpath ? path.join(path.dirname(process.env.npm_execpath), 'npx-cli.js') : path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js')
    if (process.platform === 'win32') await access(windowsNpx)
    const env = { ...process.env }; delete env.CAPGO_PRIVATE_KEY
    const result = spawnSync(process.platform === 'win32' ? process.execPath : 'npx', process.platform === 'win32' ? [windowsNpx, ...args] : args, { cwd: root, env, stdio: ['ignore', 'ignore', 'ignore'], shell: false })
    if (result.error || result.status !== 0) throw new Error('Capgo rejected the signed OTA upload. Provider output was suppressed to protect signing material; inspect the provider dashboard securely.')
  } finally { await rm(temporary, { recursive: true, force: true }) }
  console.log(`Published signed development OTA ${process.env.ARC_WEB_BUNDLE_VERSION}`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
