import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const output = await build({ entryPoints: ['src/features/exercises/exerciseMedia.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url); new Function('require', 'module', 'exports', output.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { createExerciseMediaRepository, exercisePhotoPath } = module.exports
const owner = '11111111-1111-4111-8111-111111111111', photo = '22222222-2222-4222-8222-222222222222'
function image(extra = 1) { return new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, extra])], 'original.png', { type: 'image/png' }) }
function fixture() {
  let account = owner, acceptedInsertError = false, switchAfterStorage = false; const rows = [], originals = new Map(), storageCalls = [], writes = []
  const bucket = { upload: async (path, file, options) => { storageCalls.push(['upload', path, options]); if (originals.has(path)) return { error: { statusCode: '409', message: 'Already exists' } }; originals.set(path, file); if (switchAfterStorage) account = 'other'; return { error: null } }, download: async path => { storageCalls.push(['download', path]); return originals.has(path) ? { data: originals.get(path), error: null } : { data: null, error: new Error('Missing original') } }, createSignedUrl: async (path, ttl) => { storageCalls.push(['sign', path, ttl]); return { data: { signedUrl: 'https://private.invalid/signed-token' }, error: null } } }
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: account } } }, error: null }) }, storage: { from: name => { assert.equal(name, 'arc-fit-private'); return bucket } }, from(table) { assert.equal(table, 'exercise_media'); let filters = [], action = 'read', value, single = false; const q = { select() { return q }, eq(key, match) { filters.push(row => row[key] === match); return q }, is(key, match) { filters.push(row => row[key] === match); return q }, order() { return q }, maybeSingle() { single = true; return q }, single() { single = true; return q }, insert(row) { action = 'insert'; value = row; return q }, update(values) { action = 'update'; value = values; return q }, then(resolve) { let selected = rows.filter(row => filters.every(f => f(row))); if (action === 'insert') { rows.push(structuredClone(value)); selected = [rows.at(-1)]; writes.push([action, structuredClone(value)]); if (acceptedInsertError) { acceptedInsertError = false; return Promise.resolve({ error: new Error('Response lost after accepted insert'), data: null }).then(resolve) } } if (action === 'update') { writes.push([action, structuredClone(value)]); selected.forEach(row => Object.assign(row, value)) } return Promise.resolve({ data: single ? selected[0] ?? null : selected, error: null }).then(resolve) } }; return q } }
  return { repo: createExerciseMediaRepository(client), rows, originals, storageCalls, writes, setAccount: value => { account = value }, acceptedInsertError: () => { acceptedInsertError = true }, switchAfterStorage: () => { switchAfterStorage = true } }
}
test('private upload preserves original bytes with immutable owner path, no overwrite, stable metadata and byte-verified retries', async () => {
  const f = fixture(), file = image(), row = await f.repo.upload(owner, 'exercise', 'preset', photo, 'My setup', file)
  assert.equal(row.object_path, `${owner}/exercise-${photo}.png`); assert.equal(row.preset_id, 'preset'); assert.equal(f.storageCalls[0][2].upsert, false)
  const again = await f.repo.upload(owner, 'exercise', 'preset', photo, 'Changed retry label', file); assert.equal(again.label, 'My setup'); assert.equal(f.rows.length, 1); assert.equal(f.storageCalls.filter(c => c[0] === 'upload').length, 1); assert.ok(f.storageCalls.some(c => c[0] === 'download'))
  await assert.rejects(f.repo.upload(owner, 'exercise', 'preset', photo, 'My setup', image(2)), /differs/); assert.equal(f.rows.length, 1); assert.equal(new Uint8Array(await f.originals.get(row.object_path).arrayBuffer()).at(-1), 1)
})
test('ambiguous accepted metadata insert retries its same identity without duplicating or removing original', async () => {
  const f = fixture(); f.acceptedInsertError(); const row = await f.repo.upload(owner, 'exercise', null, photo, '', image()); assert.equal(row.id, photo); assert.equal(f.rows.length, 1); assert.equal(f.originals.size, 1)
})
test('archive/undo and label edits change metadata only and original identity remains unchanged', async () => {
  const f = fixture(), row = await f.repo.upload(owner, 'exercise', null, photo, 'Original label', image()), originalPath = row.object_path
  const archived = await f.repo.update(owner, row, { archived_at: '2026-10-14T10:00:00Z', label: 'Updated', object_path: 'forbidden' }); assert.equal(archived.object_path, originalPath); assert.equal((await f.repo.list(owner, 'exercise')).length, 0); assert.equal((await f.repo.list(owner, 'exercise', null, true)).length, 1)
  await f.repo.update(owner, archived, { archived_at: null }); assert.equal((await f.repo.list(owner, 'exercise')).length, 1); assert.equal(f.originals.size, 1); assert.deepEqual(Object.keys(f.writes.find(c => c[0] === 'update')[1]).sort(), ['archived_at', 'label'])
})
test('invalid MIME/content and foreign identity fail before storage writes, and account changes cannot insert metadata', async () => {
  const f = fixture(); await assert.rejects(f.repo.upload(owner, 'exercise', null, photo, '', new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' })), /JPEG/); await assert.rejects(f.repo.upload(owner, 'exercise', null, photo, '', new File(['wrong signature'], 'wrong.png', { type: 'image/png' })), /contents/); assert.equal(f.storageCalls.length, 0)
  f.setAccount('other'); await assert.rejects(f.repo.upload(owner, 'exercise', null, photo, '', image()), /matching/); assert.equal(f.storageCalls.length, 0)
  const changed = fixture(); changed.switchAfterStorage(); await assert.rejects(changed.repo.upload(owner, 'exercise', null, photo, '', image()), /matching/); assert.equal(changed.rows.length, 0); assert.equal(changed.originals.size, 1)
  assert.throws(() => exercisePhotoPath('../foreign', photo, 'image/png'), /identity/)
})
test('signed previews renew using short TTL and originals download only through owned verified paths', async () => {
  const f = fixture(), row = await f.repo.upload(owner, 'exercise', null, photo, 'Exercise', image()); await f.repo.signedUrl(owner, row); await f.repo.signedUrl(owner, row); assert.equal(f.storageCalls.filter(c => c[0] === 'sign').length, 2); assert.ok(f.storageCalls.filter(c => c[0] === 'sign').every(c => c[2] === 600)); assert.equal((await f.repo.original(owner, row)).size, image().size)
  const before = f.storageCalls.length; await assert.rejects(f.repo.signedUrl(owner, { ...row, user_id: 'foreign' }), /another account/); await assert.rejects(f.repo.original(owner, { ...row, object_path: '../foreign/path.png' }), /identity/); assert.equal(f.storageCalls.length, before)
})
test('private media panel and both exercise entry screens bundle with distinct Windows-safe module names', async () => {
  const ui = await build({ stdin: { contents: "export {default as ExerciseMediaPanel} from './src/features/exercises/ExerciseMediaPanel';export {default as ExerciseSettings} from './src/features/exercises/ExerciseSettings';export {default as PersonalDetails} from './src/features/exercises/PersonalDetails';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
  const rendered = { exports: {} }; new Function('require', 'module', 'exports', ui.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), rendered, rendered.exports)
  assert.equal(typeof rendered.exports.ExerciseSettings, 'function'); assert.equal(typeof rendered.exports.PersonalDetails, 'function')
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), html = renderToStaticMarkup(React.createElement(rendered.exports.ExerciseMediaPanel, { userId: owner, exerciseId: 'exercise' }))
  assert.match(html, /Upload private photo/); assert.match(html, /image\/jpeg,image\/png,image\/webp/); assert.doesNotMatch(html, /<img/)
})
