import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function validatePreviewEnvironment(env) {
  if (env.BRANCH !== 'develop') throw new Error('Preview build requires the develop branch.')
  for (const name of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY']) {
    if (env[name]) throw new Error(`Remove ${name} from this frontend preview environment.`)
  }
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('VITE_') && (/SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|ACCESS_TOKEN|API_KEY/i.test(name) || String(value).startsWith('sb_secret_'))) {
      throw new Error(`Disallowed private frontend variable: ${name}`)
    }
  }
  let url
  try { url = new URL(env.VITE_SUPABASE_URL) } catch { throw new Error('Configure VITE_SUPABASE_URL in Netlify.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Supabase URL must use HTTPS without credentials, query or fragment.')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!key) throw new Error('Configure VITE_SUPABASE_PUBLISHABLE_KEY in Netlify.')
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return
  try {
    const parts = key.split('.')
    if (parts.length === 3 && JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role === 'anon') return
  } catch { /* Reject malformed and privileged keys without logging their values. */ }
  throw new Error('Use a Supabase publishable key or legacy anon key, never a secret/service-role key.')
}

export function verifyPreviewOutput(directory = 'dist') {
  const assets = readdirSync(resolve(directory, 'assets')).filter(name => /\.(js|css)$/.test(name))
  const worker = readFileSync(resolve(directory, 'service-worker.js'), 'utf8')
  if (!/gym-tracker-release-[a-f0-9]{16}/.test(worker) || assets.some(name => !worker.includes(`/assets/${name}`))) {
    throw new Error('Release service-worker cache does not contain every build chunk.')
  }
  const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'))
  if (manifest.display !== 'standalone' || !manifest.icons?.some(icon => icon.sizes === '192x192') || !manifest.icons.some(icon => icon.sizes === '512x512')) {
    throw new Error('Installable app manifest or icons are missing.')
  }
  for (const icon of manifest.icons) readFileSync(resolve(directory, icon.src.replace(/^\//, '')))
  for (const name of assets.filter(name => name.endsWith('.js'))) {
    const source = readFileSync(resolve(directory, 'assets', name), 'utf8')
    if (['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'my-workout/', 'import-performance'].some(marker => source.includes(marker)) || /sb_secret_[A-Za-z0-9_-]{12,}/.test(source)) {
      throw new Error('Private credential/import marker found in the preview output.')
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    validatePreviewEnvironment(process.env)
    const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit', env: process.env })
    if (result.error || result.status !== 0) throw new Error('Vite preview build failed.')
    verifyPreviewOutput()
    console.log('Develop preview build verified: public configuration, release cache and manifest.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
