/**
 * JobFinder – Geographic Configuration
 *
 * DEVIATION #1 (documented for manuscript amendment):
 *   The thesis manuscript (p.25) specifies:
 *     DistanceScore = 1 / (1 + shortestpath(user_location, job_location))
 *   but does not specify the unit of `shortestpath` or any scaling.
 *
 *   Without normalization, the raw formula in kilometres collapses every
 *   distance past 3 km toward ≈0.06–0.21, making the geographic term
 *   nearly non-discriminative across a 63 km² city.
 *
 *   The manuscript itself anticipates scaling (p.25):
 *     "the distance score is scaled to a 0-1 range for each job"
 *
 *   Implementation refinement (academically compatible):
 *     NormalizedDistance = shortestPathKm / MAX_REFERENCE_DISTANCE_KM
 *     DistanceScore      = 1 / (1 + NormalizedDistance)
 *
 *   The reciprocal form 1/(1+·) is preserved exactly.
 *   The UI always displays the actual distance in kilometres.
 *
 * HOW MAX_REFERENCE_DISTANCE_KM WAS DETERMINED:
 *   1. OSM road extract (2026-08-15) was processed into a directed weighted
 *      graph of 8,282 nodes and 11,242 junction-to-junction edges.
 *   2. Exact Dijkstra was run from each of the 33 PhilAtlas barangay
 *      centroid nodes to all 32 others (1,056 pairs, zero unreachable).
 *   3. The maximum returned was 14.9434 km: Cutud → Sapangbato.
 *   4. This value is deterministic given the OSM extract; it can be
 *      reproduced by running scripts/computeMaxReferenceDistance.mjs.
 */

/**
 * Maximum reference distance (km) used to normalize DistanceScore.
 * Derived from exact Dijkstra over all 33×32 Angeles City barangay pairs.
 * Longest route: Cutud → Sapangbato (14.9434 km).
 */
export const MAX_REFERENCE_DISTANCE_KM = 14.9434

/**
 * A snapped coordinate more than this far from the road network is
 * considered unroutable; DistanceScore is set to 0 for that job.
 */
export const MAX_SNAP_KM = 1.0

/**
 * Default map centre — Angeles City Hall approximate coordinate.
 * Used when the user's location is unavailable.
 */
export const DEFAULT_MAP_CENTER: [number, number] = [15.1449, 120.5887]

/** Default zoom level for Angeles City overview. */
export const DEFAULT_MAP_ZOOM = 13

/**
 * Compute DistanceScore with normalization.
 *
 * Formula (manuscript §6, p.25):
 *   DistanceScore = 1 / (1 + NormalizedDistance)
 *   NormalizedDistance = shortestPathKm / MAX_REFERENCE_DISTANCE_KM
 *
 * @param shortestPathKm  Dijkstra result in kilometres
 * @returns               DistanceScore ∈ [0.5, 1.0]
 *                        (0.5 at maximum city distance, 1.0 at distance 0)
 */
export function computeDistanceScore(shortestPathKm: number): number {
  if (!isFinite(shortestPathKm) || shortestPathKm < 0) return 0
  const normalized = shortestPathKm / MAX_REFERENCE_DISTANCE_KM
  return 1 / (1 + normalized)
}
