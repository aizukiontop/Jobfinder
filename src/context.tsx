import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'

import type {
  Job,
  User,
  Application,
  Page,
  Employer,
  EmployerJob,
  ApplicantRecord,
} from './types'

import { SAMPLE_JOBS } from './data'
import { skillMatchScore } from './lib/skillMatch'
import { computeMatchScore } from './config/matching'
import { computeDistanceScore } from './config/geo'
import { loadRoadGraph, snapToGraph, type RoadGraph } from './lib/roadGraph'
import { dijkstra } from './lib/dijkstra'

// ── Road graph singleton — lazy-loaded once and cached for the session ─────────
// All Dijkstra scoring calls share this reference so the 1.96 MB JSON is only
// fetched once. The promise is stored so concurrent callers await the same load.
let _roadGraphPromise: Promise<RoadGraph> | null = null

function getRoadGraph(): Promise<RoadGraph> {
  if (!_roadGraphPromise) {
    _roadGraphPromise = loadRoadGraph()
  }
  return _roadGraphPromise
}

/**
 * Compute the Dijkstra-based DistanceScore G(a,j) for a user→job pair.
 *
 * Thesis §Method (p.25):
 *   DistanceScore = 1 / (1 + NormalizedDistance)
 *   NormalizedDistance = shortestPathKm / MAX_REFERENCE_DISTANCE_KM
 *
 * Returns 0 if:
 *   • coordinates are missing
 *   • either point snaps too far from the road network
 *   • Dijkstra finds no path (disconnected subgraph)
 */
async function computeDijkstraDistanceScore(
  userLat: number,
  userLng: number,
  jobLat: number,
  jobLng: number
): Promise<number> {
  try {
    const graph = await getRoadGraph()
    const snapUser = snapToGraph(userLat, userLng, graph)
    const snapJob  = snapToGraph(jobLat,  jobLng,  graph)
    if (!snapUser || !snapJob) return 0

    const result = dijkstra(graph, snapUser.nodeId, snapJob.nodeId)
    if (!result.found) return 0

    // Total road distance = Dijkstra path + snap offsets
    const totalKm = result.distanceKm + snapUser.snapDistKm + snapJob.snapDistKm
    return computeDistanceScore(totalKm)
  } catch {
    return 0
  }
}

// ── Demo employer account (login only – no seeded jobs or applicants) ─────────
const DEMO_EMPLOYER: Employer = {
  id: 'emp-demo',
  email: 'hr@premiertechph.com',
  password: 'demo123',
  contactName: 'HR Manager',
  companyName: 'Premier Tech Solutions',
  industry: 'Information Technology',
  description:
    'Premier Tech Solutions is a leading IT services company based in Angeles City.',
  address: 'Balibago, Angeles City, Pampanga',
  contactEmail: 'hr@premiertechph.com',
  contactPhone: '(045) 888-1234',
  website: 'www.premiertechph.com',
  companySize: '51-200 employees',
}

// ── Data version — bump this string to wipe stale seed data from localStorage ─
// v2 = first clean version (removes fake ej1-ej4 jobs and ap1-ap5 applicants)
const DATA_VERSION = 'v2'

interface AppState {
  page: Page
  selectedJobId: string | null
  prevPage: Page | null

  user: User | null
  employer: Employer | null

  savedJobIds: string[]
  applications: Application[]
  postedJobs: Job[]

  employerJobs: EmployerJob[]
  allApplicants: ApplicantRecord[]

  searchQuery: string

  /** Persisted user location — survives Search ↔ JobDetail navigation */
  userLat: number | null
  userLng: number | null
  userInsideCity: boolean | null
  locMode: 'gps' | 'pin'
  setUserLocation: (lat: number, lng: number, inside: boolean, mode: 'gps' | 'pin') => void
  clearUserLocation: () => void

  navigate: (page: Page, jobId?: string | null) => void

  setUser: (user: User | null) => void
  setEmployer: (employer: Employer | null) => void

  toggleSave: (jobId: string) => void
  addApplication: (app: Application) => void
  addPostedJob: (job: Job) => void

  addEmployerJob: (job: EmployerJob) => void
  updateEmployerJob: (id: string, updates: Partial<EmployerJob>) => void

  updateApplicantStatus: (id: string, status: ApplicantRecord['status']) => void

  updateEmployer: (updates: Partial<Employer>) => void
  updateUser: (updates: Partial<User>) => void

  setSearchQuery: (q: string) => void

  allJobs: Job[]

  /**
   * Ontology-based SkillMatchScore (thesis §Method p.26).
   * Returns S(a,j) ∈ [0,1].
   */
  calculateSkillMatchScore: (job: Job) => number

  /**
   * Full composite score: MatchScore = α×S + β×G.
   *
   * Thesis §Method (p.25–27):
   *   G(a,j) is computed via Dijkstra's Algorithm on the OSM road network.
   *   MatchScore = α × SkillMatchScore + β × DistanceScore, α=0.70, β=0.30
   *
   * Async because it lazy-loads the 1.96 MB road graph on first call.
   * Returns MatchScore ∈ [0,1]; multiply by 100 for percentage display.
   * When userLat/userLng are absent, G=0 (skill-only score).
   */
  calculateMatchScore: (job: Job, userLat?: number, userLng?: number) => Promise<number>

  hasApplied: (jobId: string) => boolean

  /** Applicant count for a specific job derived from actual records. */
  getApplicantCount: (jobId: string) => number

  /** Applicants for a specific job, ranked by skill score (employer view). */
  getApplicantsForJob: (jobId: string) => ApplicantRecord[]
}

const AppContext = createContext<AppState | null>(null)

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/**
 * Migration: runs once per browser when DATA_VERSION changes.
 *
 * v2 removes the fake seeded employer jobs (ej1–ej4) and fake applicants
 * (ap1–ap5) that were stored in localStorage by earlier builds.
 * Real employer jobs and real applicants created through the UI are preserved
 * because their IDs do not match the fake seed IDs.
 */
function runMigrations() {
  try {
    const stored = localStorage.getItem('jf_data_version')
    if (stored === DATA_VERSION) return // already migrated

    // ── Remove fake seeded employer jobs ──────────────────────────────────────
    const FAKE_JOB_IDS = new Set(['ej1', 'ej2', 'ej3', 'ej4'])
    const rawJobs = localStorage.getItem('jf_employer_jobs')
    if (rawJobs) {
      const jobs: EmployerJob[] = JSON.parse(rawJobs)
      const clean = jobs.filter(j => !FAKE_JOB_IDS.has(j.id))
      localStorage.setItem('jf_employer_jobs', JSON.stringify(clean))
    }

    // ── Remove fake seeded applicants ─────────────────────────────────────────
    const FAKE_APPLICANT_IDS = new Set(['ap1', 'ap2', 'ap3', 'ap4', 'ap5'])
    const rawAps = localStorage.getItem('jf_applicants')
    if (rawAps) {
      const aps: ApplicantRecord[] = JSON.parse(rawAps)
      const clean = aps.filter(a => !FAKE_APPLICANT_IDS.has(a.id))
      localStorage.setItem('jf_applicants', JSON.stringify(clean))
    }

    // ── Ensure demo employer exists in the employers list ─────────────────────
    const rawEmployers = localStorage.getItem('jf_employers')
    const employers: Employer[] = rawEmployers ? JSON.parse(rawEmployers) : []
    if (!employers.find(e => e.id === DEMO_EMPLOYER.id)) {
      localStorage.setItem('jf_employers', JSON.stringify([...employers, DEMO_EMPLOYER]))
    }

    localStorage.setItem('jf_data_version', DATA_VERSION)
  } catch { /* ignore storage errors */ }
}

// ── Migrate legacy 'Submitted'/'new' statuses to 'applied' ───────────────────
function migrateApplicationStatus<T extends { status: string }>(items: T[]): T[] {
  return items.map(a => ({
    ...a,
    status: (a.status === 'Submitted' || a.status === 'new') ? 'applied' : a.status,
  }))
}

/**
 * Compute SkillMatchScore for an ApplicantRecord against an EmployerJob.
 * Used for employer applicant ranking (skill-only, no distance).
 */
function computeApplicantMatchScore(
  applicantSkills: string[],
  jobRequiredSkills: string[]
): number {
  if (!applicantSkills?.length || !jobRequiredSkills?.length) return 0
  return skillMatchScore(jobRequiredSkills, applicantSkills)
}

// Run migrations before any state is initialised
runMigrations()

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('home')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [prevPage, setPrevPage] = useState<Page | null>(null)

  // ── Persisted user location (survives Search ↔ JobDetail navigation) ───────
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [userInsideCity, setUserInsideCity] = useState<boolean | null>(null)
  const [locMode, setLocMode] = useState<'gps' | 'pin'>('gps')

  const [user, setUserState] = useState<User | null>(() => loadStorage('jf_user', null))
  const [employer, setEmployerState] = useState<Employer | null>(() => loadStorage('jf_employer', null))

  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => loadStorage('jf_saved', []))
  const [applications, setApplications] = useState<Application[]>(() =>
    migrateApplicationStatus(loadStorage('jf_apps', []))
  )
  const [postedJobs, setPostedJobs] = useState<Job[]>(() => loadStorage('jf_posted', []))

  // Employer jobs: loaded from localStorage (already migrated — no fake seeds)
  const [employerJobs, setEmployerJobs] = useState<EmployerJob[]>(() =>
    loadStorage('jf_employer_jobs', [])
  )

  // Applicants: loaded from localStorage (already migrated — no fake seeds)
  const [allApplicants, setAllApplicants] = useState<ApplicantRecord[]>(() =>
    migrateApplicationStatus(loadStorage('jf_applicants', []))
  )

  const [searchQuery, setSearchQueryState] = useState('')

  useEffect(() => {
    user ? localStorage.setItem('jf_user', JSON.stringify(user)) : localStorage.removeItem('jf_user')
  }, [user])
  useEffect(() => {
    employer ? localStorage.setItem('jf_employer', JSON.stringify(employer)) : localStorage.removeItem('jf_employer')
  }, [employer])
  useEffect(() => { localStorage.setItem('jf_saved', JSON.stringify(savedJobIds)) }, [savedJobIds])
  useEffect(() => { localStorage.setItem('jf_apps', JSON.stringify(applications)) }, [applications])
  useEffect(() => { localStorage.setItem('jf_posted', JSON.stringify(postedJobs)) }, [postedJobs])
  useEffect(() => { localStorage.setItem('jf_employer_jobs', JSON.stringify(employerJobs)) }, [employerJobs])
  useEffect(() => { localStorage.setItem('jf_applicants', JSON.stringify(allApplicants)) }, [allApplicants])

  const setUserLocation = (lat: number, lng: number, inside: boolean, mode: 'gps' | 'pin') => {
    setUserLat(lat)
    setUserLng(lng)
    setUserInsideCity(inside)
    setLocMode(mode)
  }

  const clearUserLocation = () => {
    setUserLat(null)
    setUserLng(null)
    setUserInsideCity(null)
    setLocMode('gps')
  }

  const navigate = (newPage: Page, jobId?: string | null) => {
    setPrevPage(page)
    setPage(newPage)
    if (jobId !== undefined) setSelectedJobId(jobId ?? null)
    window.scrollTo(0, 0)
  }

  const setUser = (u: User | null) => setUserState(u)
  const setEmployer = (e: Employer | null) => setEmployerState(e)

  const toggleSave = (jobId: string) => {
    setSavedJobIds(prev =>
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    )
  }

  const addApplication = (app: Application) => {
    setApplications(prev => [app, ...prev])

    // Create an ApplicantRecord so the employer can see this applicant
    const allJobsList = [...postedJobs, ...SAMPLE_JOBS]
    const job = allJobsList.find(j => j.id === app.jobId)
    const empJob = employerJobs.find(j => j.id === app.jobId)
    const requiredSkills =
      job?.requiredSkills ?? empJob?.requiredSkills ?? job?.skills ?? empJob?.skills ?? []
    const applicantSkills = app.applicantSkills ?? []

    const score = computeApplicantMatchScore(applicantSkills, requiredSkills)

    const record: ApplicantRecord = {
      id: `ap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      jobId: app.jobId,
      jobTitle: app.jobTitle,
      applicantName: `${app.firstName} ${app.lastName}`,
      applicantEmail: app.email,
      appliedDate: app.dateApplied,
      matchScore: score,
      status: 'applied',
      phone: app.phone,
      coverLetter: app.coverLetter,
      applicantSkills,
    }
    setAllApplicants(prev => [record, ...prev])
  }

  const addPostedJob = (job: Job) => setPostedJobs(prev => [job, ...prev])

  const addEmployerJob = (job: EmployerJob) => setEmployerJobs(prev => [job, ...prev])

  const updateEmployerJob = (id: string, updates: Partial<EmployerJob>) => {
    setEmployerJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j))
  }

  const updateApplicantStatus = (id: string, status: ApplicantRecord['status']) => {
    setAllApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const updateEmployer = (updates: Partial<Employer>) => {
    setEmployerState(prev => prev ? { ...prev, ...updates } : prev)
  }

  const updateUser = (updates: Partial<User>) => {
    setUserState(prev => prev ? { ...prev, ...updates } : prev)
  }

  const setSearchQuery = (q: string) => setSearchQueryState(q)

  const allJobs = [...postedJobs, ...SAMPLE_JOBS]

  /**
   * Jobs visible to the currently logged-in employer.
   * Each employer only sees jobs they created (matched by employerId).
   */
  const myEmployerJobs = employer
    ? employerJobs.filter(j => j.employerId === employer.id)
    : []

  /**
   * Applicants visible to the currently logged-in employer.
   * Only applicants who applied to this employer's own jobs.
   */
  const myJobIds = new Set(myEmployerJobs.map(j => j.id))
  const myApplicants = allApplicants.filter(a => myJobIds.has(a.jobId))

  // ── Skill matching ──────────────────────────────────────────────────────────
  const calculateSkillMatchScore = (job: Job): number => {
    if (!user) return 0
    const required = job.requiredSkills?.length ? job.requiredSkills : job.skills ?? []
    return skillMatchScore(required, user.skills)
  }

  const calculateMatchScore = async (
    job: Job,
    userLat?: number,
    userLng?: number
  ): Promise<number> => {
    if (!user) return 0

    // S(a,j) — ontology-based skill match (synchronous)
    const S = calculateSkillMatchScore(job)

    // G(a,j) — Dijkstra shortest-path geographic accessibility (async)
    // Thesis §Method (p.25): DistanceScore = 1/(1 + shortestPathKm/14.9434)
    let G = 0
    if (userLat != null && userLng != null && job.lat && job.lng) {
      G = await computeDijkstraDistanceScore(userLat, userLng, job.lat, job.lng)
    }

    // MatchScore = α×S + β×G  (α=0.70, β=0.30)
    return computeMatchScore(S, G)
  }

  const hasApplied = (jobId: string) =>
    applications.some(app => app.jobId === jobId)

  /** Derived applicant count from actual records (employer-scoped). */
  const getApplicantCount = (jobId: string) =>
    myApplicants.filter(a => a.jobId === jobId).length

  /**
   * Applicants for a specific job, ranked by SkillMatchScore.
   * Only returns applicants for jobs belonging to the current employer.
   */
  const getApplicantsForJob = (jobId: string): ApplicantRecord[] => {
    // Safety: only allow fetching applicants for jobs this employer owns
    if (!myJobIds.has(jobId)) return []

    const job = myEmployerJobs.find(j => j.id === jobId)
    const required = job?.requiredSkills ?? job?.skills ?? []

    return myApplicants
      .filter(a => a.jobId === jobId)
      .map(a => ({
        ...a,
        matchScore: a.applicantSkills?.length
          ? computeApplicantMatchScore(a.applicantSkills, required)
          : a.matchScore,
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
  }

  return (
    <AppContext.Provider
      value={{
        page,
        selectedJobId,
        prevPage,
        user,
        employer,
        savedJobIds,
        applications,
        postedJobs,
        // Expose only this employer's jobs and applicants to the UI
        employerJobs: myEmployerJobs,
        allApplicants: myApplicants,
        searchQuery,
        userLat,
        userLng,
        userInsideCity,
        locMode,
        setUserLocation,
        clearUserLocation,
        navigate,
        setUser,
        setEmployer,
        toggleSave,
        addApplication,
        addPostedJob,
        addEmployerJob,
        updateEmployerJob,
        updateApplicantStatus,
        updateEmployer,
        updateUser,
        setSearchQuery,
        allJobs,
        calculateSkillMatchScore,
        calculateMatchScore,
        hasApplied,
        getApplicantCount,
        getApplicantsForJob,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}