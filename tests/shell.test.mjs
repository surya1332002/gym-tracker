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
  for (const [path, title] of [['/', 'Your ARC'], ['/workout', 'Workout'], ['/exercises', 'Exercises'], ['/progress', 'Progress'], ['/profile', 'Profile']]) {
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

test('mobile order centres Workout and highlights the actual selected tab; future menu is disabled', () => {
  for (const [path, active] of [['/exercises/search', 'Exercises'], ['/workout/build', 'Workout'], ['/profile', 'Profile']]) {
    const html = render(path)
    const dock = html.slice(html.indexOf('class="mobile-dock"'))
    const labels = [...dock.matchAll(/<span>(Home|Exercises|Workout|Progress|Profile)<\/span>/g)].map(match => match[1])
    assert.deepEqual(labels, ['Home', 'Exercises', 'Workout', 'Progress', 'Profile'])
    const selected = dock.match(/<a[^>]*aria-current="page"[^>]*>(.*?)<\/a>/)?.[1]
    assert.ok(selected?.includes(`<span>${active}</span>`))
    assert.match(html, /<button[^>]*class="future-menu"[^>]*disabled=""[^>]*aria-label="Menu — coming soon"/)
    assert.match(html, /<span>ARC<\/span> <span>FIT<\/span>/)
  }
})
test('ARC FIT header removes persistent workout banner and puts sign out on Profile only', () => {
  const html = render('/')
  assert.ok(html.includes('ARC FIT'))
  assert.ok(!html.includes('Your workout, within reach'))
  assert.ok(!html.includes('Sign out'))
  assert.ok(render('/profile').includes('Account')); assert.ok(render('/profile/account').includes('Sign out on this device'))
})
test('exercise and workout landing routes expose exactly the requested primary choices', () => {
  const exercises = render('/exercises')
  for (const label of ['Search from List', 'Custom', 'My List']) assert.ok(exercises.includes(`>${label}</a>`))
  assert.equal((exercises.match(/class="flow-choices flow-tiles"/g) ?? []).length, 1)
  const workout = render('/workout')
  for (const label of ['Build Workout', 'Start Workout']) assert.ok(workout.includes(`<strong>${label}</strong>`))
  assert.ok(!workout.includes('Push A'))
})
test('persistence routes expose online saving, truthful workout previews and separate private exercise identities', () => {
  assert.ok(render('/workout/build').includes('Create Workout'))
  assert.ok(render('/workout/start').includes('Choose Workout'))
  assert.ok(render('/workout/start').includes('Random Workout'))
  assert.ok(!render('/workout/start').includes('Saved programmes'))
  assert.ok(render('/workout/start/choose').includes('Saved programmes'))
  assert.ok(render('/exercises/search').includes('Search from List'))
  assert.ok(render('/exercises/search').includes('Browse by muscle group'))
  assert.ok(render('/exercises/my-list').includes('custom exercises and selected catalogue exercises'))
  assert.ok(render('/exercises/my-list').includes('preserves history'))
  assert.ok(render('/exercises/custom').includes('New personal exercise'))
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

test('workout entry screens keep exactly two compact choices and builder starts with programme selection', () => {
 const home=render('/workout'),start=render('/workout/start'),build=render('/workout/build')
 assert.equal((home.match(/href="\/workout\/(build|start)"/g)??[]).length,2)
 assert.equal((start.match(/class="compact-row"/g)??[]).length,2)
 assert.match(start,/Use your saved routines/);assert.match(start,/Start without a saved routine/)
 assert.match(build,/Create Workout/);assert.doesNotMatch(build,/Choose your split|Planned sets|Day count/)
})
