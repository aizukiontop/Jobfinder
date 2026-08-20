/**
 * Geographic utilities — haversine distance, point-in-polygon,
 * Angeles City boundary check.
 */

import boundaryData from '../data/angelesBoundary.generated.json'
import barangayData from '../data/barangayPolygons.generated.json'

/** Haversine distance between two [lat, lon] points, in kilometres. */
export function haversine(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371.0088
  const p1 = (a[0] * Math.PI) / 180
  const p2 = (b[0] * Math.PI) / 180
  const dp = p2 - p1
  const dl = ((b[1] - a[1]) * Math.PI) / 180
  const h =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Ray-casting point-in-polygon test. */
function pointInRing(
  lat: number,
  lng: number,
  ring: number[][]
): boolean {
  let inside = false
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const [y1, x1] = ring[i]
    const [y2, x2] = ring[(i + 1) % n]
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) {
      inside = !inside
    }
  }
  return inside
}

const CITY_RING = boundaryData.ring as number[][]

/**
 * Returns true if [lat, lng] is within the Angeles City administrative
 * boundary (OSM relation 9386775, admin_level=6).
 *
 * This is the authoritative boundary check used for hard-blocking jobs
 * outside the study area (Scope: "Angeles City, Pampanga, Philippines,
 * encompassing all 33 barangays within the city's administrative boundaries").
 */
export function isWithinAngelesCity(lat: number, lng: number): boolean {
  return pointInRing(lat, lng, CITY_RING)
}

export interface BarangayRecord {
  osmId: number
  canonical: string
  aliases: string[]
  centroidLat: number
  centroidLng: number
  centroidSource: string
  ring: number[][]
}

const BARANGAY_RECORDS: BarangayRecord[] = barangayData as BarangayRecord[]

/** Return the canonical barangay name for a coordinate, or null. */
export function findBarangay(lat: number, lng: number): string | null {
  for (const b of BARANGAY_RECORDS) {
    if (pointInRing(lat, lng, b.ring)) return b.canonical
  }
  return null
}

/** The 33 canonical barangay names, sorted. */
export const ANGELES_BARANGAYS: string[] = BARANGAY_RECORDS.map(b => b.canonical).sort()

/** Resolve a user-supplied string to a canonical barangay name. */
export function resolveBarangayName(name: string): string | null {
  const n = name.toLowerCase().trim()
  for (const b of BARANGAY_RECORDS) {
    if (b.canonical.toLowerCase() === n) return b.canonical
    for (const alias of b.aliases) {
      if (alias.toLowerCase() === n) return b.canonical
    }
  }
  return null
}
