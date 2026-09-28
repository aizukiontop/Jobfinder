import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { loadTypeScript } from './helpers/load-typescript.mjs'
import { makeGraph, roadGraph, bellmanFord, pathDistance, ontologyDistances } from './helpers/algorithm-reference.mjs'

const source = name => fileURLToPath(new URL('../src/' + name, import.meta.url))
const { dijkstra } = loadTypeScript(source('lib/dijkstra.ts'))
const { sim, explainSkillMatch } = loadTypeScript(source('lib/ontology.ts'))
const { skillMatchScore } = loadTypeScript(source('lib/skillMatch.ts'))
const { SKILL_NODES, SKILL_EDGES } = loadTypeScript(source('data/skillOntology.ts'))
const tolerance = 1e-9

test('ALG-01 ontology similarities agree with independent all-pairs edge distances', () => {
  const distances = ontologyDistances(SKILL_NODES, SKILL_EDGES)
  SKILL_NODES.forEach((a, i) => SKILL_NODES.forEach((b, j) => {
    const expected = Number.isFinite(distances[i][j]) ? 1 / (1 + distances[i][j]) : 0
    assert.equal(sim(a.id, b.id), expected, a.id + ' -> ' + b.id)
  }))
})

test('ALG-02 displayed per-skill breakdown averages to the actual skill score', () => {
  const required = ['JavaScript', 'Python', 'Customer Service']
  const declared = ['coding', 'customer support']
  const details = explainSkillMatch(required, declared)
  assert.equal(details.reduce((sum, detail) => sum + detail.similarity, 0) / details.length, skillMatchScore(required, declared))
  assert.equal(sim('zzunknownzz', 'JavaScript'), 0)
})

test('ALG-03 shortest route beats a more expensive direct edge', () => {
  const graph = makeGraph(['A', 'B', 'C', 'D'], [['A', 'B', 2], ['B', 'C', 1], ['C', 'D', 2], ['A', 'D', 10]])
  const result = dijkstra(graph, 'A', 'D')
  assert.equal(result.found, true)
  assert.equal(result.distanceKm, 5)
  assert.deepEqual(result.path, ['A', 'B', 'C', 'D'])
})

test('ALG-04 directed, unreachable, zero-length and nonexistent-node cases are explicit', () => {
  const graph = makeGraph(['A', 'B', 'C'], [['A', 'B', 2]])
  assert.equal(dijkstra(graph, 'B', 'A').found, false)
  assert.equal(dijkstra(graph, 'A', 'C').distanceKm, Infinity)
  assert.equal(dijkstra(graph, 'A', 'A').distanceKm, 0)
  assert.equal(dijkstra(graph, 'MISSING', 'MISSING').found, false)
})

test('ALG-05 parallel edges, ties, zero weights and a zero-weight cycle stay correct', () => {
  const graph = makeGraph(['A', 'B', 'C', 'D'], [['A', 'B', 4], ['A', 'B', 0], ['B', 'A', 0], ['A', 'C', 0], ['B', 'D', 2], ['C', 'D', 2]])
  const result = dijkstra(graph, 'A', 'D')
  assert.equal(result.distanceKm, 2)
  assert.equal(pathDistance(graph, result.path), 2)
})

test('ALG-06 production road routes agree with Bellman-Ford on the same directed graph', () => {
  const graph = roadGraph(JSON.parse(readFileSync(new URL('../public/data/roadGraph.json', import.meta.url), 'utf8')))
  const ids = Object.keys(graph.nodes).sort()
  const selected = [0, 0.13, 0.31, 0.53, 0.79, 0.99].map(fraction => ids[Math.floor(fraction * (ids.length - 1))])
  for (const from of selected) {
    const reference = bellmanFord(graph, from)
    for (const to of selected) {
      const result = dijkstra(graph, from, to)
      const expected = reference.get(to)
      assert.equal(result.found, Number.isFinite(expected))
      if (result.found) {
        assert.ok(Math.abs(result.distanceKm - expected) <= tolerance)
        assert.ok(Math.abs(pathDistance(graph, result.path) - expected) <= tolerance)
        assert.equal(result.path[0], from)
        assert.equal(result.path.at(-1), to)
      }
    }
  }
})
