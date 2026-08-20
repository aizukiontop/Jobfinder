#!/usr/bin/env node
/**
 * scripts/buildStaticGeoData.mjs
 *
 * Generates the two static JSON files consumed by src/lib/geo.ts:
 *   src/data/angelesBoundary.generated.json
 *   src/data/barangayPolygons.generated.json
 *
 * Usage:
 *   node scripts/buildStaticGeoData.mjs \
 *     --boundary  <path/to/angeles-boundary_json.json>  \
 *     --barangays <path/to/angeles-barangays_json.json>
 *
 * See buildRoadGraph.mjs for the Overpass queries to obtain the input files.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    boundary:  { type: 'string', default: 'angeles-boundary_json.json' },
    barangays: { type: 'string', default: 'angeles-barangays_json.json' },
    outDir:    { type: 'string', default: 'src/data' },
  },
})

// ── Way-segment stitcher ──────────────────────────────────────────────────────
function stitch(rel) {
  const segs = rel.members
    .filter(m => m.type === 'way' && ['outer', '', null, undefined].includes(m.role) && m.geometry?.length > 1)
    .map(m => m.geometry.map(p => [p.lat, p.lon]))

  const rings = []
  const pool = [...segs]
  while (pool.length) {
    let cur = pool.shift()
    let changed = true
    while (changed) {
      changed = false
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i]
        const cE = cur[cur.length - 1]; const cS = cur[0]
        if (eq(cE, s[0])) { cur = [...cur, ...s.slice(1)]; pool.splice(i, 1); changed = true; break }
        if (eq(cE, s[s.length - 1])) { cur = [...cur, ...[...s].reverse().slice(1)]; pool.splice(i, 1); changed = true; break }
        if (eq(cS, s[s.length - 1])) { cur = [...s.slice(0, -1), ...cur]; pool.splice(i, 1); changed = true; break }
        if (eq(cS, s[0])) { cur = [[...[...s].reverse()][0], ...s.slice(1).reverse(), ...cur]; pool.splice(i, 1); changed = true; break }
      }
    }
    if (cur.length > 2) rings.push(cur)
  }
  return rings
}

function eq(a, b) { return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 }

function round7(v) { return Math.round(v * 1e7) / 1e7 }
function roundRing(r) { return r.map(([lat, lng]) => [round7(lat), round7(lng)]) }

// ── PhilAtlas-sourced centroids (ground truth) ────────────────────────────────
const PH_CENTROIDS = {
  'Agapito del Rosario': [15.1433, 120.5887],
  'Amsic': [15.1588, 120.5679],
  'Anunas': [15.1559, 120.5551],
  'Balibago': [15.1663, 120.5901],
  'Capaya': [15.1456, 120.6173],
  'Claro M. Recto': [15.1472, 120.5927],
  'Cuayan': [15.1466, 120.5486],
  'Cutcut': [15.1376, 120.5821],
  'Cutud': [15.1750, 120.6267],
  'Lourdes Northwest': [15.1442, 120.5842],
  'Lourdes Sur': [15.1403, 120.5902],
  'Lourdes Sur East': [15.1435, 120.5940],
  'Malabañas': [15.1577, 120.5830],
  'Margot': [15.1708, 120.5355],
  'Mining': [15.1402, 120.6134],
  'Ninoy Aquino': [15.1503, 120.5962],
  'Pampang': [15.1482, 120.5745],
  'Pandan': [15.1473, 120.6053],
  'Pulungbulu': [15.1302, 120.6082],
  'Pulung Cacutud': [15.1644, 120.6172],
  'Pulung Maragul': [15.1652, 120.6032],
  'Salapungan': [15.1479, 120.5977],
  'San Jose': [15.1311, 120.5942],
  'San Nicolas': [15.1390, 120.5855],
  'Santa Teresita': [15.1493, 120.5872],
  'Santa Trinidad': [15.1419, 120.5823],
  'Santo Cristo': [15.1406, 120.5983],
  'Santo Domingo': [15.1277, 120.6002],
  'Santo Rosario': [15.1355, 120.5873],
  'Sapalibutad': [15.1582, 120.6304],
  'Sapangbato': [15.1701, 120.5142],
  'Tabun': [15.1499, 120.6146],
  'Virgen delos Remedios': [15.1500, 120.5919],
}

// OSM name → canonical name
const OSM_TO_CANONICAL = {
  'Agapito del Rosario': 'Agapito del Rosario',
  'Amsic': 'Amsic', 'Anunas': 'Anunas', 'Balibago': 'Balibago',
  'Capaya': 'Capaya', 'Claro M. Recto': 'Claro M. Recto',
  'Cuayan': 'Cuayan', 'Cutcut': 'Cutcut', 'Cutud': 'Cutud',
  'Lourdes Northwest': 'Lourdes Northwest',
  'Lourdes Sur': 'Lourdes Sur', 'Lourdes Sur East': 'Lourdes Sur East',
  'Malabañas': 'Malabañas', 'Margot': 'Margot', 'Mining': 'Mining',
  'Ninoy Aquino': 'Ninoy Aquino', 'Pampang': 'Pampang', 'Pandan': 'Pandan',
  'Pulung Bulu': 'Pulungbulu', 'Pulungbulu': 'Pulungbulu',
  'Pulung Cacutud': 'Pulung Cacutud', 'Pulung Maragul': 'Pulung Maragul',
  'Salapungan': 'Salapungan', 'San Jose': 'San Jose', 'San Nicolas': 'San Nicolas',
  'Santa Teresita': 'Santa Teresita', 'Santa Trinidad': 'Santa Trinidad',
  'Santo Cristo': 'Santo Cristo', 'Santo Domingo': 'Santo Domingo',
  'Santo Rosario': 'Santo Rosario', 'Sapalibutad': 'Sapalibutad',
  'Sapangbato': 'Sapangbato', 'Tabun': 'Tabun',
  'Virgen delos Remedios': 'Virgen delos Remedios',
}

const ALIASES = {
  'Lourdes Northwest': ['Lourdes North West', 'Lourdes NW'],
  'Malabañas': ['Malabanias', 'Malabanas'],
  'Ninoy Aquino': ['Ninoy Aquino (Marisol)', 'Marisol'],
  'Pulungbulu': ['Pulung Bulu'],
  'Santo Rosario': ['Santo Rosario (Pob.)', 'Poblacion'],
  'Claro M. Recto': ['Claro M Recto'],
  'Virgen delos Remedios': ['Virgen Delos Remedios', 'Virgen De Los Remedios'],
}

// ── Build city boundary ───────────────────────────────────────────────────────
console.log('Loading boundary…')
const B = JSON.parse(readFileSync(values.boundary, 'utf8'))
const cityRel = B.elements[0]
const cityRings = stitch(cityRel).filter(r => r.length > 2)
const cityRing = cityRings.reduce((a, b) => a.length >= b.length ? a : b)

const boundaryOut = {
  osmId: cityRel.id,
  name: cityRel.tags?.name ?? 'Angeles',
  adminLevel: cityRel.tags?.admin_level ?? '6',
  ring: roundRing(cityRing),
}

// ── Build barangay polygons ───────────────────────────────────────────────────
console.log('Loading barangays…')
const Y = JSON.parse(readFileSync(values.barangays, 'utf8'))
const matched = new Set()
const barOut = []

for (const el of Y.elements) {
  const osmName = el.tags?.name ?? ''
  const canonical = OSM_TO_CANONICAL[osmName]
  if (!canonical || matched.has(canonical)) continue

  const rings = stitch(el).filter(r => r.length > 2)
  if (!rings.length) { console.warn(`  no polygon for ${canonical}`); continue }

  const ring = rings.reduce((a, b) => a.length >= b.length ? a : b)
  const [lat, lng] = PH_CENTROIDS[canonical]
  matched.add(canonical)

  barOut.push({
    osmId: el.id,
    canonical,
    aliases: ALIASES[canonical] ?? [],
    centroidLat: lat,
    centroidLng: lng,
    centroidSource: 'PhilAtlas',
    ring: roundRing(ring),
  })
}

barOut.sort((a, b) => a.canonical.localeCompare(b.canonical))
console.log(`  matched ${barOut.length} / 33 barangays`)
if (barOut.length < 33) {
  const missing = Object.keys(PH_CENTROIDS).filter(
    n => !barOut.find(b => b.canonical === n)
  )
  console.warn('  missing:', missing)
}

// ── Write output ──────────────────────────────────────────────────────────────
mkdirSync(resolve(values.outDir), { recursive: true })

const bPath = resolve(values.outDir, 'angelesBoundary.generated.json')
writeFileSync(bPath, JSON.stringify(boundaryOut))
console.log(`\nWrote ${bPath}`)

const pPath = resolve(values.outDir, 'barangayPolygons.generated.json')
writeFileSync(pPath, JSON.stringify(barOut))
console.log(`Wrote ${pPath}`)
console.log('Done.')
