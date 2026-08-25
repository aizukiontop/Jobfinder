/**
 * JobFinder – Ontology-Based Skill Similarity
 *
 * Thesis §Method (p.24):
 *   Sim(s1, s2) = 1 / (1 + distontology(s1, s2))
 *   where distontology(s1,s2) = number of edges between the two skills in Gs
 *
 * BFS over undirected skill graph Gs. All edge types cost 1.
 * Six category trees are disjoint: Sim across categories = 0.
 */

import { SKILL_NODES, SKILL_EDGES, type SkillNode } from '../data/skillOntology'

// ─── Build adjacency list (undirected) ────────────────────────────────────────

const ADJ = new Map<string, string[]>()
for (const node of SKILL_NODES) {
  ADJ.set(node.id, [])
}
for (const edge of SKILL_EDGES) {
  ADJ.get(edge.from)?.push(edge.to)
  ADJ.get(edge.to)?.push(edge.from)
}

// ─── Synonym → node-id index ──────────────────────────────────────────────────

const SYNONYM_INDEX = new Map<string, string>() // normalised label → nodeId

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9/. ]/g, '').replace(/\s+/g, ' ')
}

for (const node of SKILL_NODES) {
  SYNONYM_INDEX.set(normalize(node.label), node.id)
  SYNONYM_INDEX.set(normalize(node.id), node.id)
  for (const syn of node.synonyms) {
    SYNONYM_INDEX.set(normalize(syn), node.id)
  }
}

/** Resolve a free-text skill string to an ontology node id, or null. */
export function resolveSkill(skill: string): string | null {
  const key = normalize(skill)
  if (SYNONYM_INDEX.has(key)) return SYNONYM_INDEX.get(key)!
  // Partial prefix match — "React Native Developer" → react_native
  for (const [synonym, id] of SYNONYM_INDEX) {
    if (key.startsWith(synonym) || synonym.startsWith(key)) return id
  }
  return null
}

// ─── BFS shortest-path cache ──────────────────────────────────────────────────

const DIST_CACHE = new Map<string, number>()

function cacheKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * BFS shortest edge-count distance between two skill nodes.
 * Returns Infinity if nodes are in different category trees (disjoint).
 */
function bfsDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!ADJ.has(a) || !ADJ.has(b)) return Infinity

  const key = cacheKey(a, b)
  if (DIST_CACHE.has(key)) return DIST_CACHE.get(key)!

  const visited = new Map<string, number>([[a, 0]])
  const queue: string[] = [a]

  while (queue.length > 0) {
    const cur = queue.shift()!
    const d = visited.get(cur)!
    for (const nbr of ADJ.get(cur) ?? []) {
      if (!visited.has(nbr)) {
        const nd = d + 1
        visited.set(nbr, nd)
        if (nbr === b) {
          DIST_CACHE.set(key, nd)
          return nd
        }
        queue.push(nbr)
      }
    }
  }

  DIST_CACHE.set(key, Infinity)
  return Infinity
}

/**
 * Semantic similarity between two skill strings.
 *
 * Thesis formula: Sim(s1,s2) = 1 / (1 + distontology(s1,s2))
 *
 * Returns:
 *   1.0  – identical skills
 *   0.5  – 1 edge apart (direct parent/child/sibling)
 *   0.0  – unresolvable or different category trees (disjoint forests)
 */
export function sim(s1: string, s2: string): number {
  const id1 = resolveSkill(s1)
  const id2 = resolveSkill(s2)

  if (!id1 || !id2) return 0

  const d = bfsDistance(id1, id2)
  if (!isFinite(d)) return 0
  return 1 / (1 + d)
}

/** All skill nodes (for UI display / debugging). */
export function getAllSkillNodes(): SkillNode[] {
  return SKILL_NODES
}

/** Skills the system could not resolve — logged for evaluation. */
export const ONTOLOGY_GAP_LOG: string[] = []

export function logOntologyGap(skill: string): void {
  if (!ONTOLOGY_GAP_LOG.includes(skill)) {
    ONTOLOGY_GAP_LOG.push(skill)
    console.warn(`[Ontology] No node found for skill: "${skill}"`)
  }
}

// ─── Skill Match Breakdown (explainability only) ──────────────────────────────
// Uses the same ADJ, SYNONYM_INDEX, and bfsDistance already in this module.
// Does NOT replace or duplicate skillMatchScore() — it re-exposes the
// intermediate values that produce the existing SkillMatchScore.

export interface SkillMatchDetail {
  /** The job's required skill label */
  required: string
  /** The applicant skill that produced the highest similarity */
  bestMatch: string | null
  /** Sim value ∈ [0,1] — identical to what skillMatchScore() accumulates */
  similarity: number
  /** BFS edge count between the two resolved nodes */
  distance: number
  /** 'exact' = distance 0 | 'ontology' = distance 1+ | 'missing' = no path */
  matchType: 'exact' | 'ontology' | 'missing'
  /** Human-readable node labels along the shortest BFS path */
  ontologyPath: string[]
}

/**
 * Per-requirement breakdown of ontology-based skill matching.
 *
 * Uses the SAME resolved nodes, BFS graph (ADJ), distances, and similarity
 * values that skillMatchScore() in skillMatch.ts computes — the only
 * addition is capturing the path nodes so the UI can display them.
 *
 * Invariant:
 *   average(detail.similarity for detail in explainSkillMatch(req, user))
 *   === skillMatchScore(req, user)
 */
export function explainSkillMatch(
  requiredSkills: string[],
  userSkills: string[]
): SkillMatchDetail[] {
  const nodeLabel = (id: string): string => {
    const node = SKILL_NODES.find(n => n.id === id)
    return node ? node.label : id
  }

  /** BFS that also records predecessor map so the full path can be reconstructed. */
  function bfsWithPath(a: string, b: string): { distance: number; path: string[] } {
    if (a === b) return { distance: 0, path: [a] }
    if (!ADJ.has(a) || !ADJ.has(b)) return { distance: Infinity, path: [] }

    const prev = new Map<string, string | null>([[a, null]])
    const queue: string[] = [a]

    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const nbr of ADJ.get(cur) ?? []) {
        if (!prev.has(nbr)) {
          prev.set(nbr, cur)
          if (nbr === b) {
            const path: string[] = []
            let step: string | null = b
            while (step !== null) {
              path.unshift(step)
              step = prev.get(step) ?? null
            }
            return { distance: path.length - 1, path }
          }
          queue.push(nbr)
        }
      }
    }
    return { distance: Infinity, path: [] }
  }

  return requiredSkills.map(ri => {
    const riId = resolveSkill(ri)

    let bestSim = 0
    let bestUj: string | null = null
    let bestUjId: string | null = null

    for (const uj of userSkills) {
      const ujId = resolveSkill(uj)
      if (!riId || !ujId) continue
      const d = bfsDistance(riId, ujId)
      const s = isFinite(d) ? 1 / (1 + d) : 0
      if (s > bestSim) {
        bestSim = s
        bestUj = uj
        bestUjId = ujId
      }
    }

    let distance = Infinity
    let path: string[] = []
    if (riId && bestUjId) {
      const result = bfsWithPath(riId, bestUjId)
      distance = result.distance
      path = result.path.map(nodeLabel)
    }

    const matchType: SkillMatchDetail['matchType'] =
      distance === 0 ? 'exact' :
      isFinite(distance) ? 'ontology' :
      'missing'

    return {
      required: ri,
      bestMatch: bestUj,
      similarity: bestSim,
      distance,
      matchType,
      ontologyPath: path,
    }
  })
}
