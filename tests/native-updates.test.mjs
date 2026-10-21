import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
const output = await build({ entryPoints: ['src/native/otaPolicy.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' })
const module = { exports: {} }
new Function('module', 'exports', output.outputFiles[0].text)(module, module.exports)
const { compatibleVersion, newerVersion, safeToActivate, createLaunchActivation } = module.exports
const hash = 'a'.repeat(64)
const release = { contractId: 'arc-fit-storage-1', nativeBaselineHash: hash }
const staged = { id: 'verified-bundle', version: `1.0.4+${hash}`, checksum: 'signed', baseline: hash }
const clean = { pending: 0, foreignData: false, activeWorkout: false, dirtyDraft: false, conflict: false, onlineVerified: true, activeEditor: false }

test('OTA namespace requires exact native/data contract; downgrades and malformed versions rejected', () => {
  assert.equal(compatibleVersion(staged.version, release, '1.0.0'), true)
  for (const version of ['1.0.4', `1.1.4+${hash}`, `2.0.4+${hash}`, `1.0.4+${'b'.repeat(64)}`, `garbage+${hash}`]) assert.equal(compatibleVersion(version, release, '1.0.0'), false)
  assert.equal(compatibleVersion(staged.version, { ...release, contractId: 'unknown' }, '1.0.0'), false)
  assert.equal(newerVersion(staged.version, `1.0.3+${hash}`), true)
  assert.equal(newerVersion(staged.version, staged.version), false)
  assert.equal(newerVersion(staged.version, `1.0.5+${hash}`), false)
  assert.equal(newerVersion('invalid', staged.version), false)
})
test('active workouts, outbox, draft edits, other owners, conflicts and unverifiable offline state defer activation', () => {
  assert.equal(safeToActivate(clean), true)
  for (const key of ['foreignData', 'activeWorkout', 'dirtyDraft', 'conflict', 'activeEditor']) assert.equal(safeToActivate({ ...clean, [key]: true }), false)
  assert.equal(safeToActivate({ ...clean, pending: 1 }), false)
  assert.equal(safeToActivate({ ...clean, onlineVerified: false }), false)
})
test('startup activation is once only, including StrictMode, auth switches and concurrent calls', async () => {
  const gate = createLaunchActivation(staged)
  let checks = 0, activations = 0
  const check = async () => { checks++; return true }
  const activate = async bundle => { assert.equal(bundle, staged); activations++ }
  await Promise.all([gate.run(check, activate), gate.run(check, activate)])
  await gate.run(check, activate)
  assert.equal(checks, 1); assert.equal(activations, 1)
})
test('a completed download in the same launch never gains startup eligibility', async () => {
  const gate = createLaunchActivation(null)
  let activated = false
  await gate.run(async () => true, async () => { activated = true })
  gate.close()
  await gate.run(async () => true, async () => { activated = true })
  assert.equal(activated, false)
})
test('timeouts cannot activate late after editing screens are released', async () => {
  const gate = createLaunchActivation(staged)
  let finishCheck, activations = 0
  const result = await gate.run(() => new Promise(resolve => { finishCheck = resolve }), async () => { activations++ }, 5)
  assert.equal(result, false)
  finishCheck(true)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(activations, 0)
})
test('unknown storage or failed eligibility never switches bundle', async () => {
  for (const check of [async () => false, async () => { throw new Error('Device data unavailable') }]) {
    let activations = 0
    assert.equal(await createLaunchActivation(staged).run(check, async () => { activations++ }), false)
    assert.equal(activations, 0)
  }
})
test('eligibility timeout cannot release an editor while terminal native activation is in flight', async () => {
  let finishActivation
  const gate = createLaunchActivation(staged)
  let released = false
  const result = gate.run(async () => true, () => new Promise(resolve => { finishActivation = resolve }), 5).then(value => { released = true; return value })
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(released, false)
  finishActivation()
  assert.equal(await result, true)
})
