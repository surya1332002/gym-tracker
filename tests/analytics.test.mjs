import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
const bundle = await build({ entryPoints: ['src/features/progress/analytics.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' })
const module = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports)
const { completedSessions, exercisePoints, muscleSets, weeklyActivity, estimated1Rm, personalRecords } = module.exports
const set = (lb, reps, completed = true) => ({ lb, reps, completed })
const session = (id, date, sets, completedAt = '2026-10-10T10:00:00Z') => ({ id, date, startedAt: `${date}T09:00:00Z`, completedAt, exercises: [{ exerciseId: 'press', name: 'Press', muscle: 'Chest', sets }] })
test('analytics excludes unfinished, invalid-date and duplicate sessions and uncompleted planned sets', () => {
  const actual = session('a', '2026-10-10', [set('100', '10'), set('500', '10', false)])
  const rows = [actual, actual, session('pending', '2026-10-10', [set('300', '5', false)], null), session('bad', '2026-02-31', [set('300', '5')]), { ...session('trash', '2026-10-10', [set('1000', '5')]), deletedAt: '2026-10-11T00:00:00Z' }]
  assert.equal(completedSessions(rows).length, 1)
  const [p] = exercisePoints(rows); assert.equal(p.workingSets, 1); assert.equal(p.weightKg, 45.359237); assert.ok(Math.abs(p.volumeKg - 453.59237) < 1e-8)
  assert.deepEqual(muscleSets(rows), [['Chest', 1]])
})
test('unknown bodyweight loads stay unknown and receive set credit without invented volume or 1RM', () => {
  const [p] = exercisePoints([session('a', '2026-10-10', [set('', '12'), set('', '')])])
  assert.equal(p.weightKg, null); assert.equal(p.estimated1RmKg, null); assert.equal(p.volumeKg, 0); assert.equal(p.workingSets, 1)
  assert.equal(personalRecords([p]).length, 0)
})
test('estimated maximum restricts Epley to positive load and 1–10 integral reps', () => {
  assert.equal(estimated1Rm(100, 1), 100); assert.equal(estimated1Rm(100, 6), 120)
  for (const [kg, reps] of [[100, 11], [0, 10], [-1, 2], [100, 2.5], [Infinity, 2]]) assert.equal(estimated1Rm(kg, reps), null)
})
test('weekly training uses Monday boundaries and does not count future weeks', () => {
  const rows = ['2026-10-04', '2026-10-05', '2026-10-11', '2026-10-12'].map((date, i) => session(String(i), date, [set('10', '10')]))
  assert.deepEqual(weeklyActivity(rows, new Date(2026, 9, 10)).map(s => s.date), ['2026-10-05', '2026-10-11'])
})
test('heaviest PR remains associated with its real achievement date', () => {
  const points = exercisePoints([session('a', '2026-10-01', [set('100', '5')]), session('b', '2026-10-02', [set('90', '10')])])
  assert.equal(personalRecords(points)[0].date, '2026-10-01')
})
test('stored canonical kg wins over rounded display lb and warmups do not receive working-set credit', () => {
  const row = session('a', '2026-10-10', [{ ...set('22.0462', '10'), weightKg: 10 }, { ...set('90', '5'), setType: 'warmup' }])
  const [point] = exercisePoints([row]); assert.equal(point.volumeKg, 100); assert.equal(point.weightKg, 10); assert.equal(point.workingSets, 1)
  assert.deepEqual(muscleSets([row]), [['Chest', 1]])
})
test('completed work in active/incomplete sessions contributes performance without completed session frequency', () => {
  const rows = [session('active', '2026-10-10', [set('100', '10')], null), { ...session('partial', '2026-10-10', [set('110', '5')]), completionKind: 'incomplete' }]
  assert.equal(exercisePoints(rows).length, 2); assert.equal(completedSessions(rows).length, 0); assert.equal(muscleSets(rows)[0][1], 2)
})

test('repeated exercise identity aggregates session volume and set credit without merging different identities',()=>{const row=session('repeat','2026-10-10',[set('40','10')]);row.exercises.push({...row.exercises[0],sets:[set('50','8')]},{...row.exercises[0],exerciseId:'different',sets:[set('60','5')]});const points=exercisePoints([row]);assert.equal(points.length,2);const press=points.find(p=>p.exerciseId==='press');assert.equal(press.workingSets,2);assert.ok(Math.abs(press.volumeKg-800*0.45359237)<1e-9);assert.equal(press.weightKg,50*0.45359237);assert.equal(row.exercises[0].sets.length,1)});
