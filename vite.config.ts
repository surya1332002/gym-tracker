import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// https://vite.dev/config/
export default defineConfig({
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
      const assets = Object.keys(bundle).filter(name => /\.(?:js|css)$/.test(name)).sort()
      const release = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 16)
      const source = readFileSync('public/service-worker.js', 'utf8')
        .replace("'gym-tracker-shell-v2'", JSON.stringify('gym-tracker-release-' + release))
        .replace(/const ASSETS = [^;]+;/, 'const ASSETS = ' + JSON.stringify(['/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', ...assets.map(name => '/' + name)]) + ';')
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source })
    },
  }],
})
