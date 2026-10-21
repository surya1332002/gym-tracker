import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const nativeBuild = process.env.ARC_NATIVE_BUILD === '1'
const nativeBaselineHash = process.env.ARC_NATIVE_BASELINE_SHA256 ?? ''
if (nativeBuild && !/^[a-f0-9]{64}$/.test(nativeBaselineHash)) throw new Error('Native build requires a verified native/storage baseline. Use npm run android:build.')
const nativeRelease = {
  contractId: 'arc-fit-storage-1', nativeBaselineHash,
  webVersion: process.env.ARC_WEB_BUNDLE_VERSION ?? '1.0.0',
  channel: process.env.ARC_OTA_CHANNEL ?? 'development',
  otaEnabled: nativeBuild && Boolean(process.env.ARC_OTA_PUBLIC_KEY?.trim()),
}

// https://vite.dev/config/
export default defineConfig({
  define: { __ARC_NATIVE_RELEASE__: JSON.stringify(nativeBuild ? nativeRelease : { ...nativeRelease, webVersion: 'Web/PWA', otaEnabled: false }) },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (!id.includes('node_modules')) return
    if (id.includes('@supabase/')) return 'cloud'
    if (id.includes('@noble/')) return 'encryption'
    if (id.includes('dexie')) return 'offline'
    if (id.includes('react')) return 'ui'
    return 'vendor'
  } } } },
  plugins: [react(), {
    name: 'arc-fit-offline-release',
    apply: 'build',
    generateBundle(_options, bundle) {
      const revision = (process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).trim()
      const branch = (process.env.BRANCH || execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' })).trim()
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ application: 'ARC FIT', commit: revision, branch }) })
      if (nativeBuild) this.emitFile({ type: 'asset', fileName: 'native-release.json', source: JSON.stringify(nativeRelease) })
      const assets = Object.keys(bundle).filter(name => /\.(?:js|css)$/.test(name)).sort()
      const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'))
      const publicFiles = ['/index.html', '/manifest.json', '/icons/arc-fit.svg', ...manifest.icons.map((icon: {src: string}) => icon.src)]
      const releaseHash = createHash('sha256').update(assets.join('\n'))
      for (const file of publicFiles.filter(file => file !== '/index.html')) releaseHash.update(readFileSync('public' + file))
      const release = releaseHash.digest('hex').slice(0, 16)
      const source = readFileSync('public/service-worker.js', 'utf8')
        .replace("'gym-tracker-shell-v2'", JSON.stringify('gym-tracker-release-' + release))
        .replace(/const ASSETS = [^;]+;/, 'const ASSETS = ' + JSON.stringify([...publicFiles, ...assets.map(name => '/' + name)]) + ';')
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source })
    },
  }],
})
