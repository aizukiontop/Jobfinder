export type Page =
  | 'home'
  | 'search'
  | 'saved'
  | 'applications'
  | 'signin'
  | 'register'
  | 'profile'
  | 'postjob'
  | 'jobdetail'
  | 'apply'
  | 'employer-dashboard'
  | 'employer-jobs'
  | 'employer-post'
  | 'employer-applicants'
  | 'employer-profile'

export type UserRole = 'job-seeker' | 'employer'

/**
 * Data source classification (Section 7 of thesis requirements):
 *   external-verified  — real posting with source URL
 *   prototype          — sample/demo data, clearly labelled
 *   employer-created   — posted via JobFinder employer dashboard
 */
export type DataSource = 'external-verified' | 'prototype' | 'employer-created'

export interface Job {
  id: string
  title: string
  company: string
  location: string
  city: string
  province: string
  /** Canonical barangay name, null if not specified, 'Unknown' if unverifiable. */
  barangay: string | null
  address: string

  salary: string
  salaryMin: number
  salaryMax: number
  employmentType: string
  workArrangement: string
  experienceLevel: string
  category: string

  description: string
  responsibilities: string[]
  /** Required skills (ri) — used in SkillMatchScore thesis formula. */
  requiredSkills: string[]
  /** Preferred/bonus skills — separate PreferredSkillScore, NOT in primary ranking. */
  preferredSkills: string[]
  requirements: string[]
  benefits: string[]
  /** Legacy field kept for backward compat; requiredSkills is canonical. */
  skills: string[]
  openings: number
  daysAgo: number

  /** Verified workplace latitude — never fabricated. */
  lat: number
  /** Verified workplace longitude — never fabricated. */
  lng: number
  /**
   * How precise the coordinate is:
   *   'exact-address'      — geocoded from full street address
   *   'barangay-centroid'  — PhilAtlas barangay centroid
   *   'city-centroid'      — Angeles City center, barangay unknown
   */
  coordinateSource: 'exact-address' | 'barangay-centroid' | 'city-centroid'

  datePosted?: string
  expirationDate?: string
  applicationUrl?: string
  sourceUrl?: string

  /** Clearly distinguishes real postings from sample/demo data. */
  dataSource: DataSource

  postedBy?: string
}

export interface User {
  id: string
  email: string
  password: string
  firstName: string
  lastName: string
  headline: string
  photo: string
  /** Applicant's declared skills (uj) — matched against requiredSkills. */
  skills: string[]
  preferredLocation: string
  preferredEmploymentType: string
  careerCategory: string
  education: string
  experienceLevel: string
  resumeName: string
  resumeDate: string
  role?: UserRole

  // Geographic fields (thesis: user location for Dijkstra)
  barangay?: string | null
  lat?: number | null
  lng?: number | null

  // Demographic fields (thesis evaluation demographics, p.24)
  ageBracket?: '18-24' | '25-34' | '35-44' | '45-50' | ''
  gender?: 'Male' | 'Female' | 'Prefer not to say' | ''
  civilStatus?: 'Single' | 'Married' | 'Other' | ''
  employmentStatus?: 'Unemployed' | 'Underemployed' | 'Fresh graduate' | 'Actively seeking' | ''
  yearsExperience?: string
  transportMode?: 'Walking' | 'Motorcycle' | 'Jeepney' | 'Tricycle' | 'Car' | 'Bicycle' | ''
  maxCommuteKm?: number
}

export interface Application {
  id: string
  jobId: string
  jobTitle: string
  company: string
  dateApplied: string
  status: 'applied' | 'reviewing' | 'shortlisted' | 'interview' | 'hired' | 'rejected'
  firstName: string
  lastName: string
  email: string
  phone: string
  coverLetter: string
  /** Snapshot of applicant skills at time of application (for employer ranking). */
  applicantSkills?: string[]
}

export interface Employer {
  id: string
  email: string
  password: string
  contactName: string
  companyName: string
  industry: string
  description: string
  address: string
  contactEmail: string
  contactPhone: string
  website: string
  companySize: string
}

export interface EmployerJob {
  id: string
  employerId: string
  title: string
  company: string
  category: string
  description: string
  requirements: string
  employmentType: string
  workArrangement: string
  location: string
  city: string
  barangay?: string | null
  address?: string
  salary: string
  salaryMin: number
  salaryMax: number
  openings: number
  deadline: string
  status: 'active' | 'closed' | 'draft'
  postedDate: string
  daysAgo: number
  /** Derived from actual Application records — never hardcoded. */
  applicantCount: number
  requiredSkills: string[]
  preferredSkills?: string[]
  /** Legacy skills field kept for migration compatibility. */
  skills: string[]
  experienceLevel: string
  lat?: number
  lng?: number
  coordinateSource?: 'exact-address' | 'barangay-centroid' | 'city-centroid'
}

export interface ApplicantRecord {
  id: string
  jobId: string
  jobTitle: string
  applicantName: string
  applicantEmail: string
  appliedDate: string
  /**
   * Computed via ontology-based SkillMatchScore at application time.
   * Displayed as 0–100%. Never hardcoded.
   */
  matchScore: number
  status: 'applied' | 'reviewing' | 'shortlisted' | 'interview' | 'hired' | 'rejected'
  phone?: string
  coverLetter?: string
  resumeName?: string
  applicantSkills?: string[]
}
