import type { Job } from '../types'
import { getAllSkillNodes, resolveSkill, sim } from './ontology'

type SearchableJob = Pick<Job, 'title' | 'company' | 'category' | 'description' | 'requiredSkills' | 'skills'>

export const RELATED_SKILL_MIN_SIMILARITY = 1 / 3

export function createJobSearch(query: string) {
  const text = query.toLowerCase().trim()
  const skillId = text ? resolveSkill(text) : null
  const skillLabel = getAllSkillNodes().find(skill => skill.id === skillId)?.label ?? null
  const relatedSkills = new Map<string, boolean>()

  const matches = (job: SearchableJob): boolean => {
    if (!text) return true
    const required = job.requiredSkills?.length ? job.requiredSkills : job.skills ?? []

    if (
      job.title.toLowerCase().includes(text) ||
      job.company.toLowerCase().includes(text) ||
      job.category.toLowerCase().includes(text) ||
      job.description.toLowerCase().includes(text) ||
      required.some(skill => skill.toLowerCase().includes(text))
    ) return true

    if (!skillId) return false
    return required.some(skill => {
      if (!relatedSkills.has(skill)) {
        relatedSkills.set(skill, sim(text, skill) >= RELATED_SKILL_MIN_SIMILARITY)
      }
      return relatedSkills.get(skill)!
    })
  }

  return { matches, skillLabel }
}
