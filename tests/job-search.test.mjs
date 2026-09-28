import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

// Test the real TypeScript modules without adding a runtime dependency.
const require = createRequire(import.meta.url)
const cache = new Map()
function loadTypeScript(filename) {
  filename = path.resolve(filename)
  if (!path.extname(filename)) filename += '.ts'
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const execute = runInThisContext('(function(require, module, exports) {\n' + outputText + '\n})', { filename })
  execute(specifier => specifier.startsWith('.')
    ? loadTypeScript(path.resolve(path.dirname(filename), specifier))
    : require(specifier), module, module.exports)
  return module.exports
}

const { createJobSearch } = loadTypeScript(fileURLToPath(new URL('../src/lib/jobSearch.ts', import.meta.url)))
const { skillMatchScore } = loadTypeScript(fileURLToPath(new URL('../src/lib/skillMatch.ts', import.meta.url)))
const makeJob = (overrides = {}) => ({
  title: 'Open position', company: 'Example Company', category: 'General',
  description: '', requiredSkills: [], skills: [], ...overrides,
})

test('empty searches preserve every job', () => {
  assert.equal(createJobSearch('  ').matches(makeJob()), true)
  assert.equal(createJobSearch('').skillLabel, null)
})

test('ordinary keyword searches cover all existing searchable fields', () => {
  for (const field of ['title', 'company', 'category', 'description']) {
    assert.equal(createJobSearch('Acme').matches(makeJob({ [field]: 'An ACME opportunity' })), true)
  }
  assert.equal(createJobSearch('welding').matches(makeJob({ requiredSkills: ['Welding'] })), true)
})

test('coding resolves to Programming and finds connected developer skills', () => {
  const query = createJobSearch('coding')
  assert.equal(query.skillLabel, 'Programming')
  for (const skill of ['Programming', 'JavaScript', 'Python', 'Node JS', 'C++', 'Unity']) {
    assert.equal(query.matches(makeJob({ requiredSkills: [skill] })), true, skill)
  }
  assert.equal(query.matches(makeJob({ requiredSkills: ['React'] })), false)
})

test('synonyms and canonical labels find the same related jobs', () => {
  const jobs = ['JavaScript', 'Python', 'Bookkeeping', 'Customer Service'].map(skill => makeJob({ requiredSkills: [skill] }))
  assert.deepEqual(jobs.map(createJobSearch('coding').matches), jobs.map(createJobSearch('programming').matches))
  assert.equal(createJobSearch('  CoDiNg  ').matches(jobs[0]), true)
  assert.equal(createJobSearch('JS').matches(jobs[0]), true)
})

test('disconnected and unknown skills do not become semantic matches', () => {
  for (const skill of ['Bookkeeping', 'Nursing', 'Welding']) {
    assert.equal(createJobSearch('coding').matches(makeJob({ requiredSkills: [skill] })), false)
  }
  assert.equal(createJobSearch('zzunknownzz').matches(makeJob({ requiredSkills: ['JavaScript'] })), false)
})

test('nontechnical synonyms and unknown literal terms remain searchable', () => {
  assert.equal(createJobSearch('customer support').matches(makeJob({ requiredSkills: ['Communication'] })), true)
  assert.equal(createJobSearch('zzunknownzz').matches(makeJob({ description: 'Experience with zzunknownzz equipment' })), true)
})

test('empty required skills fall back to legacy skills', () => {
  const query = createJobSearch('coding')
  assert.equal(query.matches(makeJob({ skills: ['Python'] })), true)
  assert.equal(query.matches(makeJob({ requiredSkills: undefined, skills: ['Python'] })), true)
  assert.equal(query.matches(makeJob({ requiredSkills: ['Bookkeeping'], skills: ['Python'] })), false)
})

test('search does not modify jobs or profile skill scores', () => {
  const job = makeJob({ requiredSkills: ['JavaScript'] })
  const original = structuredClone(job)
  const scoreBefore = skillMatchScore(job.requiredSkills, ['coding'])
  createJobSearch('coding').matches(job)
  assert.deepEqual(job, original)
  assert.equal(skillMatchScore(job.requiredSkills, ['coding']), scoreBefore)
  assert.equal(scoreBefore, 1 / 3)
})

test('BUG-01 common skill words no longer match every real job', () => {
  const jobs = JSON.parse(readFileSync(new URL('../src/data/jobs.verified.json', import.meta.url), 'utf8'))
  const count = query => jobs.filter(createJobSearch(query).matches).length
  assert.equal(count('cashier'), 11)
  assert.equal(count('excel'), 4)
  assert.equal(count('inventory'), 22)
  assert.ok(count('customer service') < jobs.length)
  for (const query of ['cashier', 'excel', 'customer service']) {
    const literal = jobs.filter(job => [job.title, job.company, job.category, job.description, ...(job.requiredSkills ?? [])]
      .join(' ').toLowerCase().includes(query))
    assert.ok(literal.every(createJobSearch(query).matches), query)
  }
})
