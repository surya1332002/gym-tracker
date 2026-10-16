import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const bundle = await build({ stdin: { contents: "export * from './src/features/exercises/muscleGroups'; export * from './src/features/exercises/catalogueMedia'; export * from './src/features/exercises/catalogue'; export {default as CatalogueBrowser} from './src/features/exercises/CatalogueBrowser'; export {default as ExercisePicture} from './src/features/exercises/ExercisePicture';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'no-live-client', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url)
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { muscleGroups, matchesMuscle, filterExercises, catalogueImages, CatalogueBrowser, ExercisePicture } = module.exports
const source = JSON.parse(readFileSync('data/catalogue/free-exercise-db/prepared/catalogue.normalized.json', 'utf8'))
const exercises = source.map(row => ({ catalogueId: row.id, name: row.name, muscleGroup: row.primary_muscle ?? 'Multiple / not recorded', primaryMuscles: row.source_metadata.record.primaryMuscles, equipment: row.equipment ?? undefined }))
const render = query => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(CatalogueBrowser, { exercises, ready: true, params: new URLSearchParams(query), setParams() {}, userId: 'fixture', memberships: [], membershipReady: true, onChanged() {} })))

test('fifteen categories cover all primary targets without grouping by secondary muscles', () => {
  assert.deepEqual(muscleGroups.map(group => group.name), ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs/Core', 'Glutes', 'Quads', 'Hamstrings', 'Calves', 'Traps', 'Neck', 'Adductors', 'Abductors'])
  assert.ok(exercises.every(exercise => muscleGroups.some(group => matchesMuscle(exercise, group.id))))
  const exercise = { muscleGroup: 'lats', primaryMuscles: ['lats', 'shoulders'], secondaryMuscles: ['biceps'] }
  assert.equal(matchesMuscle(exercise, 'back'), true)
  assert.equal(matchesMuscle(exercise, 'shoulders'), true)
  assert.equal(matchesMuscle(exercise, 'biceps'), false)
  assert.equal(matchesMuscle({ primaryMuscles: ['quadriceps'] }, 'quads'), true)
  assert.equal(matchesMuscle({ primaryMuscles: ['abdominals'] }, 'abs-core'), true)
})
test('default catalogue shows categories and global search, never exercise cards', () => {
  const html = render('')
  assert.match(html, /Browse All Exercises/)
  assert.match(html, /Search all exercises/)
  assert.equal((html.match(/class="catalogue-card-link"/g) ?? []).length, 0)
  for (const group of muscleGroups) assert.ok(html.includes(`?muscle=${group.id}`))
  assert.doesNotMatch(render('q=+++'), /catalogue-card-link/)
})
test('explicit browsing is paginated; group search and equipment combine; detail links retain scope', () => {
  const all = render('browse=all')
  assert.match(all, /876 exercises found/)
  assert.equal((all.match(/class="catalogue-card-link"/g) ?? []).length, 40)
  assert.match(all, /Show more exercises/)
  const filtered = filterExercises(exercises, 'press', 'chest', 'dumbbell')
  const html = render('muscle=chest&q=press&equipment=dumbbell')
  assert.ok(filtered.length > 0)
  assert.equal((html.match(/class="catalogue-card-link"/g) ?? []).length, filtered.length)
  assert.match(html, /Search in Chest/)
  assert.match(html, /No photo available/)
  assert.match(html, /Add to My List/)
  assert.match(html, /\?muscle=chest&amp;q=press&amp;equipment=dumbbell/)
})
test('stored image URLs cannot authorize themselves; reviewed matches alone are exposed', () => {
  const id = 'fixture', url = 'https://example.com/licensed-exercise.png'
  const refs = [{ url, rights_status: 'verified' }]
  const approval = { catalogueId: id, url, attribution: 'Fixture author', license: 'CC BY 4.0', evidenceUrl: 'https://example.com/license' }
  assert.deepEqual(catalogueImages(id, refs), [])
  assert.deepEqual(catalogueImages(id, null, [approval]), [])
  assert.deepEqual(catalogueImages('other', refs, [approval]), [])
  assert.deepEqual(catalogueImages(id, refs, [{ ...approval, evidenceUrl: '' }]), [])
  assert.deepEqual(catalogueImages(id, refs, [approval]), [approval])
  assert.deepEqual(catalogueImages(id, [{ url: 'javascript:alert(1)' }], [{ ...approval, url: 'javascript:alert(1)' }]), [])
  const fallback = renderToStaticMarkup(React.createElement(ExercisePicture, { name: 'Fixture exercise' }))
  assert.match(fallback, /No photo available/)
  assert.doesNotMatch(fallback, /<img/)
})
