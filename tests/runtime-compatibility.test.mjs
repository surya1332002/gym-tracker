import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { webcrypto } from 'node:crypto'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const bundle = await build({
  stdin: { contents: "export * from './src/lib/uuid'; export { default as AppShell } from './src/app/AppShell'; export {ThemeProvider} from './src/app/ThemeProvider'; export {default as AppErrorBoundary} from './src/app/AppErrorBoundary';", resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' },
  plugins: [{ name: 'no-live-client', setup(b) {
    b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true }))
  } }],
})
const module = { exports: {} }, require = createRequire(import.meta.url)
runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require: name => name === 'fixture-client' ? { supabase: {} } : require(name), TextEncoder,TextDecoder, crypto: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) } })
const { createUuid, AppShell, ThemeProvider, AppErrorBoundary } = module.exports

test('LAN HTTP UUID fallback creates unique RFC 4122 version 4 identities', () => {
  const ids = Array.from({ length: 1000 }, () => createUuid())
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(createUuid({ randomUUID: () => 'native-id' }), 'native-id')
  assert.throws(() => createUuid({}), /safe workout identifiers/)
})
test('authenticated Home and workout builder mount without crypto.randomUUID', () => {
  for (const path of ['/', '/workout/build']) {
    const html = renderToStaticMarkup(React.createElement(ThemeProvider, null,
      React.createElement(MemoryRouter, { initialEntries: [path] },
        React.createElement(AppShell, { userId: 'fixture-user', logout() {}, signingOut: false, sessionError: '' }))))
    assert.match(html, /ARC/)
    assert.match(html, path === '/' ? /Home/ : /Build Workout/)
  }
})
test('error fallback is accessible and does not display exception details', () => {
  const boundary = new AppErrorBoundary({ children: React.createElement('p', null, 'working') })
  assert.match(renderToStaticMarkup(boundary.render()), /working/)
  boundary.state = AppErrorBoundary.getDerivedStateFromError(new Error('private exception'))
  const html = renderToStaticMarkup(boundary.render())
  assert.match(html, /role="alert"/)
  assert.match(html, /Reload app/)
  assert.doesNotMatch(html, /private exception|working/)
})
