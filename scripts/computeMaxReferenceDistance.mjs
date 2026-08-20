#!/usr/bin/env node
/**
 * scripts/computeMaxReferenceDistance.mjs
 *
 * Computes MAX_REFERENCE_DISTANCE_KM — the exact Dijkstra maximum over all
 * 33×32 Angeles City barangay-centroid pairs — and prints the result.
 *
 * This script is purely for verification/documentation. It does NOT modify
 * any source files. The computed value is used as the denominator in:
 *
 *   NormalizedDistance = shortestPathKm / MAX_REFERENCE_DISTANCE_KM
 *   DistanceScore      = 1 / (1 + NormalizedDistance)
 *
 * Usage:
 *   node scripts/computeMaxReferenceDistance.mjs \
 *     --graph public/data/roadGraph.json
 *
 * Expected output (OSM extract 2026-08-15):
 *   MAX_REFERENCE_DISTANCE_KM = 14.9434 km
 *   Pair: Cutud → Sapangbato
 */

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    graph: { type: 'string', default: 'public/data/roadGraph.json' },
  },
})

// ── Load graph ────────────────────────────────────────────────────────────────
console.log(`Loading ${values.graph}…`)
const g = JSON.parse(readFileSync(values.graph, 'utf8'))
const nodes = g.nodes   // { [id]: [lat, lng] }
const edges = g.edges   // { f, t, w, ow }[]
console.log(`  ${Object.keys(nodes).length} nodes, ${edges.length} edges`)

// ── Build directed adjacency ──────────────────────────────────────────────────
const adj = new Map()
for (const e of edges) {
  if (!adj.has(e.f)) adj.set(e.f, [])
  if (!adj.has(e.t)) adj.set(e.t, [])
  if (e.ow === 'yes' || e.ow === '1') {
    adj.get(e.f).push([e.t, e.w])
  } else if (e.ow === '-1') {
    adj.get(e.t).push([e.f, e.w])
  } else {
    adj.get(e.f).push([e.t, e.w])
    adj.get(e.t).push([e.f, e.w])
  }
}

// ── Haversine snap ────────────────────────────────────────────────────────────
function hav(a, b) {
  const R = 6371.0088
  const p1 = (a[0] * Math.PI) / 180, p2 = (b[0] * Math.PI) / 180
  const dp = p2 - p1, dl = ((b[1] - a[1]) * Math.PI) / 180
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function snap(lat, lng) {
  let best = null; let bd = Infinity
  for (const [id, c] of Object.entries(nodes)) {
    const d = hav([lat, lng], c)
    if (d < bd) { bd = d; best = id }
  }
  return best
}

// ── Dijkstra (binary min-heap) ────────────────────────────────────────────────
function dijkstra(src) {
  const dist = new Map([[src, 0]])
  // Simple sorted array heap – adequate for 33 runs on 8k nodes
  const pq = [[0, src]]
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0])
    const [d, u] = pq.shift()
    if (d > (dist.get(u) ?? Infinity)) continue
    for (const [v, w] of (adj.get(u) ?? [])) {
      const nd = d + w
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); pq.push([nd, v]) }
    }
  }
  return dist
}

// ── 33 PhilAtlas barangay centroids ──────────────────────────────────────────
const CENTROIDS = {
  'Agapito del Rosario': [15.1433, 120.5887], 'Amsic': [15.1588, 120.5679],
  'Anunas': [15.1559, 120.5551], 'Balibago': [15.1663, 120.5901],
  'Capaya': [15.1456, 120.6173], 'Claro M. Recto': [15.1472, 120.5927],
  'Cuayan': [15.1466, 120.5486], 'Cutcut': [15.1376, 120.5821],
  'Cutud': [15.1750, 120.6267], 'Lourdes Northwest': [15.1442, 120.5842],
  'Lourdes Sur': [15.1403, 120.5902], 'Lourdes Sur East': [15.1435, 120.5940],
  'Malabañas': [15.1577, 120.5830], 'Margot': [15.1708, 120.5355],
  'Mining': [15.1402, 120.6134], 'Ninoy Aquino': [15.1503, 120.5962],
  'Pampang': [15.1482, 120.5745], 'Pandan': [15.1473, 120.6053],
  'Pulungbulu': [15.1302, 120.6082], 'Pulung Cacutud': [15.1644, 120.6172],
  'Pulung Maragul': [15.1652, 120.6032], 'Salapungan': [15.1479, 120.5977],
  'San Jose': [15.1311, 120.5942], 'San Nicolas': [15.1390, 120.5855],
  'Santa Teresita': [15.1493, 120.5872], 'Santa Trinidad': [15.1419, 120.5823],
  'Santo Cristo': [15.1406, 120.5983], 'Santo Domingo': [15.1277, 120.6002],
  'Santo Rosario': [15.1355, 120.5873], 'Sapalibutad': [15.1582, 120.6304],
  'Sapangbato': [15.1701, 120.5142], 'Tabun': [15.1499, 120.6146],
  'Virgen delos Remedios': [15.1500, 120.5919],
}

// Snap all centroids
const snaps = {}
for (const [nm, [lat, lng]] of Object.entries(CENTROIDS)) {
  snaps[nm] = snap(lat, lng)
}

// ── Run all-pairs Dijkstra ────────────────────────────────────────────────────
console.log(`\nRunning Dijkstra from each of ${Object.keys(snaps).length} barangay nodes…`)
let maxDist = 0; let maxPair = ['', '']
let unreachable = 0

for (const [a, na] of Object.entries(snaps)) {
  process.stdout.write(`  ${a}… `)
  const dist = dijkstra(na)
  let localMax = 0
  for (const [b, nb] of Object.entries(snaps)) {
    if (a === b) continue
    const d = dist.get(nb) ?? Infinity
    if (!isFinite(d)) unreachable++
    else if (d > maxDist) { maxDist = d; maxPair = [a, b] }
    if (isFinite(d) && d > localMax) localMax = d
  }
  console.log(`max to any = ${localMax.toFixed(3)} km`)
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log(`MAX_REFERENCE_DISTANCE_KM = ${maxDist.toFixed(4)} km`)
console.log(`Pair: ${maxPair[0]} → ${maxPair[1]}`)
if (unreachable > 0) console.warn(`WARNING: ${unreachable} unreachable pairs`)
console.log('\nUse this value in src/config/geo.ts:')
console.log(`  export const MAX_REFERENCE_DISTANCE_KM = ${maxDist.toFixed(4)}`)
