import type { CapacitorConfig } from '@capacitor/cli'
import { createPublicKey } from 'node:crypto'

// Public verification material only. The signing private key stays in release secrets.
const publicKey = process.env.ARC_OTA_PUBLIC_KEY?.replace(/\\n/g, '\n').trim()
if (publicKey) {
  const key = createPublicKey(publicKey)
  if (!publicKey.startsWith('-----BEGIN RSA PUBLIC KEY-----') || key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength !== 2048) throw new Error('Capgo Android requires a PKCS#1 RSA-2048 public verification key')
}
const channel = process.env.ARC_OTA_CHANNEL ?? 'development'
if (!['development', 'production'].includes(channel)) throw new Error('Unknown Android update channel')
const config: CapacitorConfig = {
  appId: 'com.arcfit.app', appName: 'ARC FIT', webDir: 'dist',
  // Keep this origin stable across APK and OTA upgrades: IndexedDB/vaults use it.
  server: { hostname: 'localhost', androidScheme: 'https' },
  backgroundColor: '#000000',
  android: { backgroundColor: '#000000' },
  plugins: {
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover', style: 'DARK' },
    SplashScreen: { launchAutoHide: true, launchShowDuration: 500, backgroundColor: '#000000', androidScaleType: 'CENTER_INSIDE', showSpinner: false },
    CapacitorUpdater: {
      autoUpdate: false, directUpdate: false, autoDeletePrevious: false,
      autoDeleteFailed: true, resetWhenUpdate: true, appReadyTimeout: 30000,
      defaultChannel: channel, publicKey: publicKey || undefined,
      allowModifyUrl: false, allowModifyAppId: false, allowPreview: false, allowSetDefaultChannel: false,
      shakeMenu: false, allowShakeChannelSelector: false,
    },
  },
}
export default config
