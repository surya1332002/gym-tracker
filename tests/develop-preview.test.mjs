import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { validatePreviewEnvironment } from '../scripts/build-develop-preview.mjs'

const valid = () => ({ BRANCH: 'develop', VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_public_only' })
const jwt = role => `fixture.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture`

test('preview accepts public configuration only on develop, including legacy anon compatibility', () => {
  assert.doesNotThrow(() => validatePreviewEnvironment(valid()))
  assert.doesNotThrow(() => validatePreviewEnvironment({ ...valid(), VITE_SUPABASE_PUBLISHABLE_KEY: jwt('anon') }))
  for (const BRANCH of ['main', '', undefined]) assert.throws(() => validatePreviewEnvironment({ ...valid(), BRANCH }), /develop/)
})
test('preview refuses missing, malformed and privileged credentials without revealing values', () => {
  for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) assert.throws(() => validatePreviewEnvironment({ ...valid(), [name]: '' }), /Configure/)
  for (const key of ['sb_secret_do_not_disclose', jwt('service_role'), jwt('authenticated'), 'malformed']) {
    assert.throws(() => validatePreviewEnvironment({ ...valid(), VITE_SUPABASE_PUBLISHABLE_KEY: key }), error => !error.message.includes(key))
  }
  for (const name of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_PRIVATE_KEY', 'VITE_AI_API_KEY']) {
    assert.throws(() => validatePreviewEnvironment({ ...valid(), [name]: 'sensitive-fixture-value' }), error => error.message.includes(name) && !error.message.includes('sensitive-fixture-value'))
  }
  for (const url of ['http://fixture.supabase.co', 'https://user:password@fixture.supabase.co', 'https://fixture.supabase.co/?key=private']) {
    assert.throws(() => validatePreviewEnvironment({ ...valid(), VITE_SUPABASE_URL: url }), /HTTPS/)
  }
})
test('develop context preserves the default Vite build, SPA rewrite and service-worker revalidation', () => {
  const config = readFileSync('netlify.toml', 'utf8')
  assert.match(config, /\[build\]\s+command = "npm run build"\s+publish = "dist"/)
  assert.match(config, /\[context\.develop\]\s+command = "npm run build:develop-preview"/)
  assert.match(config, /from = "\/\*"\s+to = "\/index\.html"\s+status = 200/)
  assert.match(config, /for = "\/service-worker\.js"[\s\S]*Cache-Control = "no-cache"/)
})
