import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTypeScript } from '../tests/helpers/load-typescript.mjs'
import { roadGraph, bellmanFord, pathDistance, ontologyDistances } from '../tests/helpers/algorithm-reference.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const { dijkstra } = loadTypeScript(path.join(root, 'src/lib/dijkstra.ts'))
const { sim } = loadTypeScript(path.join(root, 'src/lib/ontology.ts'))
const { SKILL_NODES, SKILL_EDGES } = loadTypeScript(path.join(root, 'src/data/skillOntology.ts'))
const bytes = readFileSync(path.join(root, 'public/data/roadGraph.json'))
const graph = roadGraph(JSON.parse(bytes))
const distances = ontologyDistances(SKILL_NODES, SKILL_EDGES)
let ontologyPairs = 0
for (let i = 0; i < SKILL_NODES.length; i++) {
  for (let j = 0; j < SKILL_NODES.length; j++) {
    const expected = Number.isFinite(distances[i][j]) ? 1 / (1 + distances[i][j]) : 0
    assert.equal(sim(SKILL_NODES[i].id, SKILL_NODES[j].id), expected)
    ontologyPairs++
  }
}

const ids = Object.keys(graph.nodes).sort()
const selected = [0, 0.13, 0.31, 0.53, 0.79, 0.99].map(fraction => ids[Math.floor(fraction * (ids.length - 1))])
const routes = []
for (const from of selected) {
  const reference = bellmanFord(graph, from)
  for (const to of selected) {
    const actual = dijkstra(graph, from, to)
    const expected = reference.get(to)
    assert.equal(actual.found, Number.isFinite(expected))
    const absoluteErrorKm = actual.found ? Math.abs(actual.distanceKm - expected) : null
    if (actual.found) {
      assert.ok(absoluteErrorKm <= 1e-9)
      assert.ok(Math.abs(pathDistance(graph, actual.path) - expected) <= 1e-9)
    }
    routes.push({ from, to, found: actual.found, distanceKm: actual.found ? actual.distanceKm : null,
      referenceKm: Number.isFinite(expected) ? expected : null, absoluteErrorKm,
      executionMs: actual.executionMs, pathNodes: actual.path.length })
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  purpose: 'Post-defense implementation correctness checks, NOT expert-labelled recommendation accuracy or real-world travel validation.',
  nodeVersion: process.version,
  inputs: {
    roadGraphSha256: createHash('sha256').update(bytes).digest('hex'),
    ontologySha256: createHash('sha256').update(readFileSync(path.join(root, 'src/data/skillOntology.ts'))).digest('hex'),
    nodeCount: ids.length, edgeCount: graph.edges.length,
  },
  ontology: { reference: 'Independent Floyd-Warshall edge-count distances', pairsChecked: ontologyPairs, pairsAgreed: ontologyPairs,
    externalRelevanceAccuracy: 'NOT MEASURED: requires independent relevance labels and held-out cases.' },
  dijkstra: { reference: 'Independent Bellman-Ford using identical directed edges and kilometre weights',
    selection: 'Deterministic six sorted node quantiles; all 36 ordered pairs, including six self-pairs.',
    absoluteToleranceKm: 1e-9, routesChecked: routes.length, routesAgreed: routes.length,
    meanExecutionMs: routes.reduce((sum, route) => sum + route.executionMs, 0) / routes.length,
    realWorldRouteAccuracy: 'NOT MEASURED: same-graph agreement does not validate map completeness or actual journey times.', routes },
}
const outputDir = path.join(root, 'docs/verification')
mkdirSync(outputDir, { recursive: true })
writeFileSync(path.join(outputDir, 'algorithm-verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log('Ontology reference agreement: ' + ontologyPairs + '/' + ontologyPairs + ' pairs')
console.log('Dijkstra reference agreement: ' + routes.length + '/' + routes.length + ' directed test routes')
console.log('Report: docs/verification/algorithm-verification.json')
console.log('These checks do not measure expert-labelled recommendation accuracy or real-world travel accuracy.')
