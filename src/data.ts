/**
 * JobFinder – Production Job Dataset
 *
 * The production dataset now uses ONLY verified real job postings sourced
 * from legitimate public sources (PhilJobNet, company websites, PESO Angeles).
 *
 * All records are in src/data/jobs.verified.json (dataSource: 'external-verified').
 *
 * PROTOTYPE DATA:
 *   The old sample/prototype jobs are preserved for rollback in:
 *   src/data/jobs.prototype.backup.ts
 *   This file is NOT imported by the production application.
 *
 * DATASET SCOPE:
 *   All jobs are within Angeles City, Pampanga (33 barangays).
 *   Jobs outside this boundary were rejected during validation.
 *
 * REJECTED RECORDS (from source spreadsheet):
 *   R06 HC Consumer Finance Sales Associate – "Pampanga Areas" (no Angeles City confirmation)
 *   R07 HC Consumer Finance Field Officer – "Pampanga Areas" (no Angeles City confirmation)
 *   R08 HC Consumer Finance Roving – Mexico, Pampanga (outside scope)
 *   R33 Crackerjack Recruitment Sewer – Clark Freeport Zone (outside scope)
 *   R34 XBP Global Data Entry – Clark Freeport Zone / Philexcel (outside scope)
 */

import type { Job } from './types'
import verifiedJobs from './data/jobs.verified.json'

/** Verified real job postings. These are the only jobs shown in production. */
export const VERIFIED_JOBS: Job[] = verifiedJobs as Job[]

/** Production dataset: verified jobs only. No prototype/sample jobs. */
export const SAMPLE_JOBS: Job[] = VERIFIED_JOBS

export const CATEGORIES = [
  { name: 'Accounting' },
  { name: 'Administrative' },
  { name: 'Construction' },
  { name: 'Customer Service' },
  { name: 'Education & Training' },
  { name: 'Engineering' },
  { name: 'Finance & Banking' },
  { name: 'Food & Beverage' },
  { name: 'Healthcare' },
  { name: 'Hospitality & Tourism' },
  { name: 'Human Resources' },
  { name: 'IT & Software' },
  { name: 'Logistics & Warehousing' },
  { name: 'Manufacturing' },
  { name: 'Marketing & Creative' },
  { name: 'Retail' },
  { name: 'Sales & Marketing' },
  { name: 'Security & Safety' },
  { name: 'Skilled Trades' },
  { name: 'Other' },
]

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary']
export const EXPERIENCE_LEVELS = ['Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive']
export const WORK_ARRANGEMENTS = ['On-site', 'Hybrid', 'Remote']
