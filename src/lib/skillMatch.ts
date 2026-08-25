/**
 * JobFinder – Ontology-Based Skill Match Score
 *
 * Thesis §Method (p.26):
 *   SkillMatchScore(job) = (1/n) × Σ [max Sim(ri, uj)], i = 1..n
 *
 * where:
 *   ri = a skill required by the job posting
 *   uj = a skill declared by the job seeker
 *   Sim(ri, uj) = ontology-based semantic similarity (edge-count BFS)
 *   n  = total number of skills required by the job
 *
 * Algorithm:
 *   For every required skill ri, find the applicant skill uj that produces
 *   the highest similarity to ri, then average those best-match values.
 *
 * NOTE: Preferred skills are handled by preferredSkillScore() — a separate
 *       function using the same formula but over preferredSkills[].
 *       PreferredSkillScore DOES NOT contribute to SkillMatchScore per the
 *       thesis scoring model. It is displayed separately for user information.
 */

import { sim, logOntologyGap, resolveSkill } from './ontology'

/**
 * Compute the ontology-based Skill Match Score.
 *
 * @param requiredSkills  Job's required skills (ri)
 * @param userSkills      Applicant's declared skills (uj)
 * @returns               SkillMatchScore ∈ [0, 1]
 */
export function skillMatchScore(
  requiredSkills: string[],
  userSkills: string[]
): number {
  const n = requiredSkills.length
  if (n === 0) return 0
  if (userSkills.length === 0) return 0

  // Warn on unresolvable skills (evaluation data)
  for (const s of [...requiredSkills, ...userSkills]) {
    if (!resolveSkill(s)) logOntologyGap(s)
  }

  // Σ [max Sim(ri, uj)] over all required skills
  let total = 0
  for (const ri of requiredSkills) {
    let best = 0
    for (const uj of userSkills) {
      const s = sim(ri, uj)
      if (s > best) best = s
    }
    total += best
  }

  return total / n
}

/**
 * Preferred Skill Score — same formula applied to preferredSkills[].
 *
 * This is NOT mixed into SkillMatchScore. It is displayed separately
 * and logged for evaluation. Adding it to the ranking requires an
 * explicit manuscript amendment and a new weighting factor γ.
 *
 * @param preferredSkills  Job's preferred/bonus skills
 * @param userSkills       Applicant's declared skills
 * @returns                PreferredSkillScore ∈ [0, 1]
 */
export function preferredSkillScore(
  preferredSkills: string[],
  userSkills: string[]
): number {
  const n = preferredSkills.length
  if (n === 0) return 0
  if (userSkills.length === 0) return 0

  let total = 0
  for (const ri of preferredSkills) {
    let best = 0
    for (const uj of userSkills) {
      const s = sim(ri, uj)
      if (s > best) best = s
    }
    total += best
  }

  return total / n
}

export interface SkillMatchDetail {
  required: string
  bestMatch: string | null
  similarity: number
}

export interface SkillMatchBreakdown {
  score: number
  details: SkillMatchDetail[]
}

export function skillMatchBreakdown(
  requiredSkills: string[],
  userSkills: string[]
): SkillMatchBreakdown {
  const details: SkillMatchDetail[] = requiredSkills.map(ri => {
    let bestMatch: string | null = null
    let similarity = 0
    for (const uj of userSkills) {
      const s = sim(ri, uj)
      if (s > similarity) {
        similarity = s
        bestMatch = uj
      }
    }
    return { required: ri, bestMatch, similarity }
  })

  const score = details.length === 0
    ? 0
    : details.reduce((sum, d) => sum + d.similarity, 0) / details.length

  return { score, details }
}
