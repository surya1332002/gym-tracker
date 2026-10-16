import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const bundle = await build({ stdin: { contents: "export * from './src/features/exercises/catalogue'; export {CatalogueFeedback} from './src/features/exercises/ExerciseLibrary';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'mock-client', setup(builder) { builder.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'mock', namespace: 'fixture' })); builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const supabase = {};' })) } }] })
const module = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
const { starterCatalogue, filterExercises, UNKNOWN_EQUIPMENT, requestCatalogue, CatalogueFeedback } = module.exports

test('starter names and muscle labels exactly match legacy defaults; absent metadata stays absent', () => {
  const source = readFileSync('src/App.tsx', 'utf8').split('const DEFAULT_EXERCISES = [')[1].split('];')[0]
  const legacy = [...source.matchAll(/name: "([^"]+)", category: "([^"]+)"/g)].map(match => [match[1], match[2]])
  assert.equal(legacy.length, 5)
  assert.deepEqual(starterCatalogue.map(item => [item.name, item.muscleGroup]), legacy)
  assert.equal(new Set(starterCatalogue.map(item => item.catalogueId)).size, 5)
  assert.ok(starterCatalogue.every(item => !item.equipment && !item.instructions))
})
test('search trims whitespace, ignores case and combines filters', () => {
  assert.deepEqual(filterExercises(starterCatalogue, '  PRESS ', '', '').map(item => item.name), ['Bench Press', 'Overhead Press'])
  assert.deepEqual(filterExercises(starterCatalogue, 'press', 'Chest', UNKNOWN_EQUIPMENT).map(item => item.name), ['Bench Press'])
  assert.equal(filterExercises(starterCatalogue, 'press', 'Back', '').length, 0)
  assert.equal(filterExercises(starterCatalogue, '', '', 'Barbell').length, 0)
  assert.equal(filterExercises(starterCatalogue, '', '', UNKNOWN_EQUIPMENT).length, 5)
  assert.equal(filterExercises(starterCatalogue, '', '', '').length, 5)
})
test('equipment filter supports future recorded metadata without changing source records', () => {
  const data = [{ catalogueId: 'synthetic-only', name: 'Synthetic test', muscleGroup: 'Test', equipment: 'Test equipment' }]
  assert.equal(filterExercises(data, '', '', 'Test equipment').length, 1)
  assert.equal(filterExercises(data, '', '', UNKNOWN_EQUIPMENT).length, 0)
})
const flush = () => new Promise(resolve => setImmediate(resolve))
test('repository lifecycle publishes loading, success and recoverable failure', async () => {
  const states = []
  requestCatalogue({ list: async () => starterCatalogue }, state => states.push(state))
  assert.equal(states[0].status, 'loading')
  await flush()
  assert.equal(states[1].exercises, starterCatalogue)
  requestCatalogue({ list() { throw new Error('synthetic failure') } }, state => states.push(state))
  await flush()
  assert.equal(states.at(-1).status, 'error')
  requestCatalogue({ list: async () => [] }, state => states.push(state))
  await flush()
  assert.deepEqual(states.at(-1), { status: 'ready', exercises: [] })
})
test('unmount/account switch suppresses late repository responses', async () => {
  let resolve
  const states = []
  const cancel = requestCatalogue({ list: () => new Promise(done => { resolve = done }) }, state => states.push(state))
  await flush()
  cancel()
  resolve(starterCatalogue)
  await flush()
  assert.deepEqual(states, [{ status: 'loading' }])
})
test('feedback renders accessible loading, empty and error with retry', () => {
  const render = state => renderToStaticMarkup(React.createElement(CatalogueFeedback, { state, retry() {} }))
  assert.match(render({ status: 'loading' }), /role="status".*Loading exercises/)
  assert.match(render({ status: 'ready', exercises: [] }), /No exercises are available/)
  assert.match(render({ status: 'error' }), /role="alert"/)
  assert.match(render({ status: 'error' }), /Try again/)
})
