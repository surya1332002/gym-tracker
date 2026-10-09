import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// Bundle in memory and replace the client. No credentials or database calls.
const bundled = await build({
  stdin: { contents: "export {default as AppShell} from './src/app/AppShell'; export {ThemeProvider} from './src/app/ThemeProvider';", resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic',
  plugins: [{ name: 'isolated-client', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'mock', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const supabase = {};' }))
  } }],
  loader: { '.css': 'empty' },
})
const module = { exports: {} }
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
const { AppShell, ThemeProvider } = module.exports
function render(path) {
  return renderToStaticMarkup(React.createElement(ThemeProvider, null,
    React.createElement(MemoryRouter, { initialEntries: [path] },
      React.createElement(AppShell, { userId: 'synthetic', email: 'test@example.invalid', logout() {}, signingOut: false, sessionError: '' }))))
}

test('all five routes render their own heading and mark the current navigation link', () => {
  for (const [path, title] of [['/', 'Home'], ['/workout', 'Workout'], ['/exercises', 'Exercises'], ['/progress', 'Progress'], ['/profile', 'Profile']]) {
    const html = render(path)
    assert.ok(html.includes(`<h1>${title}</h1>`))
    assert.ok(html.includes('aria-current="page"'))
    assert.ok(html.includes('id="main-content"'))
  }
})
test('unknown routes show an explicit recovery link', () => {
  const html = render('/missing')
  assert.ok(html.includes('Page not found'))
  assert.ok(html.includes('Go to Home'))
})
test('workout access is explicitly a future integration and cannot start a workout', () => {
  const html = render('/')
  assert.ok(html.includes('Workout logging is coming next.'))
  assert.ok(html.includes('Open Workout'))
  assert.ok(!html.includes('Start Workout'))
})
test('service worker leaves private/API requests alone and uses network first for routes', async () => {
  const handlers = {}
  const online = { ok: true }
  runInNewContext(readFileSync('public/service-worker.js', 'utf8'), {
    self: { location: { origin: 'https://fixture.invalid' }, addEventListener: (name, callback) => { handlers[name] = callback } },
    URL, Response, fetch: async () => online,
    caches: { match: async () => { throw new Error('Online routes must not use cached HTML') } },
  })
  const privateEvent = { request: { method: 'GET', url: 'https://fixture.invalid/api/private', mode: 'cors' }, respondWith() { assert.fail('Private API intercepted') } }
  handlers.fetch(privateEvent)
  let result
  handlers.fetch({ request: { method: 'GET', url: 'https://fixture.invalid/workout', mode: 'navigate' }, respondWith(value) { result = value } })
  assert.equal(await result, online)
})
