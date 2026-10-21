import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { compatibleVersion, newerVersion, createLaunchActivation, type ReleaseContract, type StagedBundle } from './otaPolicy'

declare const __ARC_NATIVE_RELEASE__: ReleaseContract
export const nativeRelease: ReleaseContract = typeof __ARC_NATIVE_RELEASE__ === 'undefined'
  ? { contractId: 'arc-fit-storage-1', nativeBaselineHash: '', webVersion: 'Web/PWA', channel: 'development', otaEnabled: false }
  : __ARC_NATIVE_RELEASE__
export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
export type UpdateState = { status: 'Up to date' | 'Downloading' | 'Ready to apply' | 'Update failed'; detail: string; appVersion: string; build: string; bundleVersion: string }
let state: UpdateState = { status: 'Up to date', detail: 'Web/PWA updates use the existing offline release mechanism.', appVersion: 'Web/PWA', build: '', bundleVersion: nativeRelease.webVersion }
const listeners = new Set<() => void>()
export const updateSnapshot = () => state
export const subscribeUpdates = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
function update(value: Partial<UpdateState>) { state = { ...state, ...value }; listeners.forEach(listener => listener()) }
const stageKey = 'arc-fit-native-staged-v1'
function readStage(): StagedBundle | null {
  if (!isNativeAndroid()) return null
  try { const value = JSON.parse(localStorage.getItem(stageKey) ?? 'null'); return value && typeof value.id === 'string' && typeof value.version === 'string' && typeof value.checksum === 'string' && value.baseline === nativeRelease.nativeBaselineHash ? value : null } catch { return null }
}
const stagedAtLaunch = readStage()
export const launchActivation = createLaunchActivation(stagedAtLaunch)
let initialization: Promise<void> | undefined
let checking = false
let nativeVersion = ''
export function initializeNativeRuntime(): Promise<void> {
  if (initialization) return initialization
  initialization = (async () => {
    if (!isNativeAndroid()) return
    const info = await App.getInfo()
    nativeVersion = info.version
    update({ appVersion: info.version, build: info.build })
    const { bundle } = await CapacitorUpdater.current()
    update({ appVersion: info.version, build: info.build, bundleVersion: bundle.id === 'builtin' ? nativeRelease.webVersion : bundle.version,
      detail: nativeRelease.otaEnabled ? 'Checking the Android development release channel.' : 'Signed OTA setup is required. Built-in app remains available.' })
    // A failed bundle must not be repeatedly reactivated from our stage marker.
    if (stagedAtLaunch?.id === bundle.id || stagedAtLaunch && (await CapacitorUpdater.list()).bundles.some(item => item.id === stagedAtLaunch.id && item.status === 'error')) localStorage.removeItem(stageKey)
    await App.addListener('appStateChange', ({ isActive }) => { if (isActive) void checkForNativeUpdate() })
    void checkForNativeUpdate()
  })().catch(() => { update({ status: 'Update failed', detail: 'Update service is unavailable. Existing app and device data are preserved.' }) })
  return initialization
}
export async function markNativeReady() {
  if (isNativeAndroid()) {
    try { await CapacitorUpdater.notifyAppReady() } catch { /* Keep app usable; native watchdog retains rollback. */ }
  }
}
async function checkForNativeUpdate() {
  if (!isNativeAndroid() || !nativeRelease.otaEnabled || checking) return
  checking = true
  try {
    const latest = await CapacitorUpdater.getLatest()
    if (latest.error) throw new Error('Update check failed')
    if (!latest.url) return
    if (latest.breaking || latest.major || !compatibleVersion(latest.version, nativeRelease, nativeVersion)) throw new Error('A new Android APK is required for this update.')
    if (!newerVersion(latest.version, state.bundleVersion)) return
    const url = new URL(latest.url)
    if (url.protocol !== 'https:' || url.username || url.password || !latest.checksum || !latest.sessionKey || latest.manifest) throw new Error('A verified encrypted release is required.')
    const staged = readStage()
    if (staged?.version === latest.version) { update({ status: 'Ready to apply', detail: 'Will apply on a safe subsequent launch after workouts and edits are saved.' }); return }
    update({ status: 'Downloading', detail: 'Your workout will remain open.' })
    // Native plugin verifies the encrypted checksum using its embedded public key.
    // No next(), reload() or set() is called from download/resume/background paths.
    const bundle = await CapacitorUpdater.download({ url: latest.url, version: latest.version, checksum: latest.checksum, sessionKey: latest.sessionKey })
    if (!['pending', 'success'].includes(bundle.status) || bundle.version !== latest.version || !bundle.checksum) throw new Error('Download verification failed')
    localStorage.setItem(stageKey, JSON.stringify({ id: bundle.id, version: bundle.version, checksum: bundle.checksum, baseline: nativeRelease.nativeBaselineHash } satisfies StagedBundle))
    update({ status: 'Ready to apply', detail: 'Will apply on a safe subsequent launch after workouts and edits are saved.' })
  } catch { update({ status: 'Update failed', detail: 'Could not obtain a compatible verified update. Existing app and device data are preserved.' }) }
  finally { checking = false }
}
export async function activateStagedAtStartup(check: () => Promise<boolean>) {
  if (!isNativeAndroid() || !nativeRelease.otaEnabled || !stagedAtLaunch) return false
  return launchActivation.run(async () => {
    // Include native bridge initialization inside the bounded eligibility check.
    await initializeNativeRuntime()
    if (!compatibleVersion(stagedAtLaunch.version, nativeRelease, nativeVersion) || !newerVersion(stagedAtLaunch.version, state.bundleVersion)) return false
    const { bundles } = await CapacitorUpdater.list()
    const bundle = bundles.find(item => item.id === stagedAtLaunch.id)
    if (!bundle || !['pending', 'success'].includes(bundle.status) || bundle.version !== stagedAtLaunch.version || bundle.checksum !== stagedAtLaunch.checksum) return false
    return check()
  }, async staged => {
    // Consume marker BEFORE the terminal native reload, protecting automatic rollback.
    localStorage.removeItem(stageKey)
    await CapacitorUpdater.set({ id: staged.id })
  })
}
