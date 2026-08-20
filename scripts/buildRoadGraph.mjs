#!/usr/bin/env node
/**
 * scripts/buildRoadGraph.mjs
 *
 * Builds public/data/roadGraph.json from OpenStreetMap road export.
 *
 * Usage:
 *   node scripts/buildRoadGraph.mjs \
 *     --roads   <path/to/angeles-roads_json.json>    \
 *     --boundary <path/to/angeles-boundary_json.json> \
 *     --barangays <path/to/angeles-barangays_json.json> \
 *     --out     public/data/roadGraph.json
 *
 * Input format: raw OSM JSON from Overpass API ("out body; >; out skel qt;")
 * Output: roadGraph.json consumed by src/lib/roadGraph.ts
 *
 * HOW TO OBTAIN THE INPUT FILES (Overpass Turbo → https://overpass-turbo.eu):
 *
 *   Road network:
 *     [out:json][timeout:300];
 *     area["boundary"="administrative"]["admin_level"="6"]["name"="Angeles"]->.a;
 *     (way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](area.a););
 *     out body; >; out skel qt;
 *
 *   City boundary:
 *     [out:json][timeout:120];
 *     relation["boundary"="administrative"]["admin_level"="6"]["name"="Angeles"];
 *     out geom;
 *
 *   Barangay polygons:
 *     [out:json][timeout:180];
 *     area["boundary"="administrative"]["admin_level"="6"]["name"="Angeles"]->.a;
 *     relation["boundary"="administrative"]["admin_level"="10"](area.a);
 *     out geom;
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'

// ── CLI args ──────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    roads:     { type: 'string', default: 'angeles-roads_json.json' },
    boundary:  { type: 'string', default: 'angeles-boundary_json.json' },
    barangays: { type: 'string', default: 'angeles-barangays_json.json' },
    out:       { type: 'string', default: 'public/data/roadGraph.json' },
  },
})

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(a, b) {
  const R = 6371.0088
  const p1 = (a[0] * Math.PI) / 180
  const p2 = (b[0] * Math.PI) / 180
  const dp = p2 - p1
  const dl = ((b[1] - a[1]) * Math.PI) / 180
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ── BFS (undirected) for connected components ─────────────────────────────────
function largestComponent(adj) {
  const seen = new Set()
  let best = []
  for (const s of adj.keys()) {
    if (seen.has(s)) continue
    const queue = [s]; seen.add(s); const comp = []
    while (queue.length) {
      const u = queue.shift(); comp.push(u)
      for (const v of (adj.get(u) ?? [])) {
        if (!seen.has(v)) { seen.add(v); queue.push(v) }
      }
    }
    if (comp.length > best.length) best = comp
  }
  return new Set(best)
}

// ── Load OSM data ─────────────────────────────────────────────────────────────
console.log('Loading road data…')
const rd = JSON.parse(readFileSync(values.roads, 'utf8'))
const rawNodes = new Map()
const rawWays = []

for (const el of rd.elements) {
  if (el.type === 'node')  rawNodes.set(el.id, [el.lat, el.lon])
  if (el.type === 'way')   rawWays.push(el)
}
console.log(`  raw nodes: ${rawNodes.size}, ways: ${rawWays.length}`)

// ── Count way references per node (to find junctions) ────────────────────────
const refCount = new Map()
for (const w of rawWays) {
  for (const nid of w.nodes) {
    refCount.set(nid, (refCount.get(nid) ?? 0) + 1)
  }
}

// ── Collapse ways into junction-to-junction edges ─────────────────────────────
const junc = new Set()
for (const w of rawWays) {
  const ns = w.nodes
  junc.add(ns[0]); junc.add(ns[ns.length - 1])
  for (let i = 1; i < ns.length - 1; i++) {
    if ((refCount.get(ns[i]) ?? 0) > 1) junc.add(ns[i])
  }
}

const edges = []
const und = new Map() // undirected adjacency for LCC

for (const w of rawWays) {
  const ns = w.nodes.filter(n => rawNodes.has(n))
  const tags = w.tags ?? {}
  const ow = tags.oneway ?? null
  let seg = []
  for (const n of ns) {
    seg.push(n)
    if (seg.length > 1 && junc.has(n)) {
      const from = seg[0]; const to = seg[seg.length - 1]
      let d = 0
      for (let i = 0; i < seg.length - 1; i++) {
        d += haversine(rawNodes.get(seg[i]), rawNodes.get(seg[i + 1]))
      }
      if (d > 0) {
        const geom = seg.map(id => { const c = rawNodes.get(id); return [c[0], c[1]] })
        edges.push({ f: from, t: to, w: Math.round(d * 1e6) / 1e6, ow, g: geom })
        if (!und.has(from)) und.set(from, new Set())
        if (!und.has(to))   und.set(to,   new Set())
        und.get(from).add(to); und.get(to).add(from)
      }
      seg = [n]
    }
  }
}

console.log(`  edges: ${edges.length}`)

// ── Find largest connected component ──────────────────────────────────────────
const LCC = largestComponent(und)
const lccEdges = edges.filter(e => LCC.has(e.f) && LCC.has(e.t))
const lccNodes = {}
for (const id of LCC) {
  const c = rawNodes.get(id)
  if (c) lccNodes[String(id)] = [Math.round(c[0] * 1e7) / 1e7, Math.round(c[1] * 1e7) / 1e7]
}
console.log(`  LCC: ${Object.keys(lccNodes).length} nodes, ${lccEdges.length} edges`)

// ── Compute max reference distance (PhilAtlas barangay centroids) ─────────────
// (Requires the barangay file to get centroids — full Dijkstra in separate script)
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

// Snap each centroid to nearest LCC node
function snap(lat, lng) {
  let best = null; let bd = Infinity
  for (const [id, c] of Object.entries(lccNodes)) {
    const d = haversine([lat, lng], c)
    if (d < bd) { bd = d; best = id }
  }
  return { nodeId: best, snapDistKm: bd }
}

// Build directed adjacency
const adjD = new Map()
for (const e of lccEdges) {
  const f = String(e.f); const t = String(e.t)
  if (!adjD.has(f)) adjD.set(f, [])
  if (!adjD.has(t)) adjD.set(t, [])
  if (e.ow === 'yes' || e.ow === '1') {
    adjD.get(f).push([t, e.w])
  } else if (e.ow === '-1') {
    adjD.get(t).push([f, e.w])
  } else {
    adjD.get(f).push([t, e.w])
    adjD.get(t).push([f, e.w])
  }
}

// Mini Dijkstra
function dijkstra(src) {
  const dist = new Map([[src, 0]])
  const pq = [[0, src]] // [dist, node]
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0])
    const [d, u] = pq.shift()
    if (d > (dist.get(u) ?? Infinity)) continue
    for (const [v, w] of (adjD.get(u) ?? [])) {
      const nd = d + w
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); pq.push([nd, v]) }
    }
  }
  return dist
}

console.log('Computing max reference distance over 33 barangay pairs…')
const snaps = {}
for (const [nm, [lat, lng]] of Object.entries(CENTROIDS)) {
  snaps[nm] = snap(lat, lng)
}

let maxDist = 0; let maxPair = ['', '']
for (const [a, sa] of Object.entries(snaps)) {
  const dist = dijkstra(sa.nodeId)
  for (const [b, sb] of Object.entries(snaps)) {
    if (a === b) continue
    const d = dist.get(sb.nodeId) ?? Infinity
    if (isFinite(d) && d > maxDist) { maxDist = d; maxPair = [a, b] }
  }
}
console.log(`  MAX: ${maxDist.toFixed(4)} km (${maxPair[0]} → ${maxPair[1]})`)

// ── Serialise output ──────────────────────────────────────────────────────────
const totalKm = lccEdges.reduce((s, e) => s + e.w, 0)
const outData = {
  meta: {
    osmExtractDate: new Date().toISOString().split('T')[0] + 'T00:00:00Z',
    builtDate: new Date().toISOString().split('T')[0],
    totalNodes: Object.keys(lccNodes).length,
    totalEdges: lccEdges.length,
    totalRoadKm: Math.round(totalKm * 100) / 100,
    largestComponentNodes: Object.keys(lccNodes).length,
    orphanComponents: und.size - LCC.size,
    maxReferenceDistanceKm: Math.round(maxDist * 1e4) / 1e4,
    maxReferenceDistancePair: maxPair,
    maxReferenceDistanceMethod:
      'Exact Dijkstra over all 33×32 PhilAtlas barangay-centroid pairs',
    license: 'ODbL - OpenStreetMap contributors',
  },
  nodes: lccNodes,
  edges: lccEdges.map(e => ({
    f: String(e.f), t: String(e.t),
    w: e.w, ow: e.ow,
    g: e.g.map(([lat, lng]) => [Math.round(lat * 1e7) / 1e7, Math.round(lng * 1e7) / 1e7]),
  })),
}

mkdirSync(dirname(values.out), { recursive: true })
writeFileSync(values.out, JSON.stringify(outData))
const sizeMB = (JSON.stringify(outData).length / 1e6).toFixed(2)
console.log(`\nWrote ${values.out} (${sizeMB} MB)`)
console.log('Done.')
