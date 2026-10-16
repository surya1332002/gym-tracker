import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const bundle = await build({ entryPoints: ['src/features/exercises/machinePresets.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /(?:^|\/)supabase$/ }, () => ({ path: 'fixture-client', external: true })) } }] })
const module = { exports: {} }, require = createRequire(import.meta.url)
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => name === 'fixture-client' ? { supabase: {} } : require(name), module, module.exports)
const { presetValues, preferenceValues, safeTutorialUrl, createMachinePresetRepository } = module.exports
const input = { label: 'Cable machine', machine_name: '', seat_position: '4', backrest_position: '', handle_or_grip: 'Rope', bench_angle: '', notes: 'Per side', other_settings: { pin: '6', side: 'Left / right' } }
test('machine settings preserve textual positions/qualifiers and independent presets', () => {
  const values = presetValues(input); assert.equal(values.seat_position, '4'); assert.equal(values.machine_name, null); assert.equal(values.notes, 'Per side'); assert.deepEqual(values.other_settings, input.other_settings)
  assert.throws(() => presetValues({ ...input, label: ' ' }), /name/)
  assert.throws(() => presetValues({ ...input, other_settings: { '': 'x' } }), /names/)
})
test('preferences preserve blank increments and reject invalid loads and unsafe tutorial links', () => {
  const pref = { notes: '', weight_unit: 'lb', weight_increment: '', is_favourite: true, tutorial_url: '' }
  assert.equal(preferenceValues(pref).weight_increment, null); assert.equal(preferenceValues({ ...pref, weight_increment: '2.5' }).weight_increment, 2.5)
  for (const value of ['0', '-1', 'Infinity', 'abc']) assert.throws(() => preferenceValues({ ...pref, weight_increment: value }), /positive/)
  for (const url of ['javascript:alert(1)', 'data:text/html,a', 'https://user:pass@example.com', '/relative']) assert.throws(() => safeTutorialUrl(url), /HTTP/)
  assert.equal(safeTutorialUrl('https://example.com/video'), 'https://example.com/video'); assert.equal(safeTutorialUrl(''), null)
})
function fixture(account = 'own') {
  const rows = [], calls = []
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: account } } } }) }, from(table) { let filters = [], action = 'read', values, one = false; const q = { select() { return q }, order() { return q }, eq(key, value) { filters.push(row => row[key] === value); return q }, insert(value) { action = 'insert'; values = value; return q }, update(value) { action = 'update'; values = value; return q }, delete() { action = 'delete'; return q }, single() { one = true; return q }, then(resolve) { calls.push({ table, action }); let data = rows.filter(row => filters.every(f => f(row))); if (action === 'insert') { if (rows.some(r => r.id === values.id)) return Promise.resolve({ data: null, error: new Error('Duplicate ID') }).then(resolve); rows.push(values); data = [values] } if (action === 'update') data.forEach(row => Object.assign(row, values)); if (action === 'delete') data.forEach(row => rows.splice(rows.indexOf(row), 1)); return Promise.resolve({ data: one ? data[0] : data, error: null }).then(resolve) } }; return q } }
  return { rows, calls, repo: createMachinePresetRepository(client) }
}
test('preset retries update the same owned identity and deletion scopes owner/exercise/id', async () => {
  const { repo, rows } = fixture(); await repo.save('own', 'press', input, 'preset'); await repo.save('own', 'press', { ...input, seat_position: '5' }, 'preset')
  assert.equal(rows.length, 1); assert.equal(rows[0].seat_position, '5'); rows.push({ id: 'other', user_id: 'else', exercise_id: 'press' })
  await repo.remove('own', 'press', 'preset'); assert.equal(rows.length, 1); assert.equal(rows[0].user_id, 'else')
  await assert.rejects(repo.remove('own', 'press', 'other'), /not confirmed/)
})
test('mismatched authentication never queries or writes personal settings', async () => {
  const { repo, calls } = fixture('else'); await assert.rejects(repo.save('own', 'press', input, 'preset'), /matching/); assert.equal(calls.length, 0)
})
test('explicit My Settings save records configuration even when the chosen increment stays blank',async()=>{const {repo,rows}=fixture();rows.push({id:'press',user_id:'own',notes:null,weight_unit:'lb',weight_increment:null,weight_preferences_configured:false});const result=await repo.savePreferences('own','press',{notes:'Seat 4',weight_unit:'kg',weight_increment:'',is_favourite:false,tutorial_url:''});assert.equal(result.weight_preferences_configured,true);assert.equal(result.weight_increment,null);assert.equal(result.weight_unit,'kg');assert.equal(rows[0].id,'press')})
