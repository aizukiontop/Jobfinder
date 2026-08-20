/**
 * JobFinder – Matching Algorithm Configuration
 *
 * Thesis: "Jobfinder: Ontology-Based Skill and Geographic Accessibility
 *          Matching for Opportunity Recommendation" (Holy Angel University, 2026)
 *
 * Final scoring formula (p.18, p.27 of manuscript):
 *   MatchScore(job) = α × SkillMatchScore + β × DistanceScore
 *   where α + β = 1
 *
 * Rationale for 70/30 split:
 *   JobFinder is primarily a job-matching system; skill compatibility should
 *   have greater influence than geographic accessibility.
 */

/** Weight assigned to skill compatibility (SkillMatchScore). */
export const ALPHA = 0.7

/** Weight assigned to geographic accessibility (DistanceScore). */
export const BETA = 0.3

// Runtime invariant — will throw during module load if misconfigured.
if (Math.abs(ALPHA + BETA - 1) > 1e-9) {
  throw new Error(`ALPHA + BETA must equal 1 (got ${ALPHA + BETA})`)
}

/**
 * Compute the composite recommendation score.
 *
 * R(a,j) = α × S(a,j) + β × G(a,j)
 *
 * @param skillMatchScore  S(a,j) ∈ [0,1] — ontology-based skill similarity
 * @param distanceScore    G(a,j) ∈ [0,1] — geographic accessibility score
 */
export function computeMatchScore(
  skillMatchScore: number,
  distanceScore: number
): number {
  return ALPHA * skillMatchScore + BETA * distanceScore
}
