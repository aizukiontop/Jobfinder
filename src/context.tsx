import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type {
  ApplicantRecord,
  Application,
  Employer,
  EmployerJob,
  Job,
  Page,
  User,
} from './types'
import { computeDistanceScore } from './config/geo'
import { computeMatchScore } from './config/matching'
import { fetchPublicJobs } from './lib/api'
import { dijkstra } from './lib/dijkstra'
import { loadRoadGraph, snapToGraph, type RoadGraph } from './lib/roadGraph'
import { skillMatchScore } from './lib/skillMatch'

// The public release deliberately exposes only the read-only job catalogue.
const PUBLIC_PAGES = new Set<Page>(['home', 'search', 'jobdetail'])

const LEGACY_STORAGE_KEYS = [
  'jf_accounts',
  'jf_employers',
  'jf_user',
  'jf_employer',
  'jf_saved',
  'jf_apps',
  'jf_posted',
  'jf_employer_jobs',
  'jf_applicants',
  'jf_data_version',
] as const

const STORAGE_CLEANUP_MARKER = 'jobfinder_public_storage_cleanup_v1'

function clearLegacyBrowserDataOnce() {
  if (typeof window === 'undefined') return

  try {
    if (window.localStorage.getItem(STORAGE_CLEANUP_MARKER)) return

    for (const key of LEGACY_STORAGE_KEYS) {
      window.localStorage.removeItem(key)
    }
    window.localStorage.setItem(STORAGE_CLEANUP_MARKER, 'complete')
  } catch {
    // Storage can be unavailable in private browsing or a restricted iframe.
    // The public app does not depend on it, so browsing can safely continue.
  }
}

// Road graph singleton: lazy-loaded once and shared by all Dijkstra calls.
let roadGraphPromise: Promise<RoadGraph> | null = null

function getRoadGraph(): Promise<RoadGraph> {
  if (!roadGraphPromise) {
    roadGraphPromise = loadRoadGraph()
  }
  return roadGraphPromise
}

/**
 * Compute the Dijkstra-based DistanceScore G(a,j) for a user-to-job pair.
 * Returns zero when coordinates are unavailable, graph snapping fails, or the
 * graph contains no route between the two snapped nodes.
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
    const snapJob = snapToGraph(jobLat, jobLng, graph)
    if (!snapUser || !snapJob) return 0

    const result = dijkstra(graph, snapUser.nodeId, snapJob.nodeId)
    if (!result.found) return 0

    const totalKm = result.distanceKm + snapUser.snapDistKm + snapJob.snapDistKm
    return computeDistanceScore(totalKm)
  } catch {
    return 0
  }
}

interface AppState {
  page: Page
  selectedJobId: string | null
  prevPage: Page | null
  user: User | null
  employer: Employer | null
  searchQuery: string

  // Inert compatibility values for legacy components that are deliberately
  // excluded from the public route graph. They never read or write storage.
  savedJobIds: string[]
  applications: Application[]
  postedJobs: Job[]
  employerJobs: EmployerJob[]
  allApplicants: ApplicantRecord[]
  setUser: (user: User | null) => void
  setEmployer: (employer: Employer | null) => void
  toggleSave: (jobId: string) => void
  addApplication: (application: Application) => void
  addPostedJob: (job: Job) => void
  addEmployerJob: (job: EmployerJob) => void
  updateEmployerJob: (id: string, updates: Partial<EmployerJob>) => void
  updateApplicantStatus: (id: string, status: ApplicantRecord['status']) => void
  updateEmployer: (updates: Partial<Employer>) => void
  updateUser: (updates: Partial<User>) => void
  hasApplied: (jobId: string) => boolean
  getApplicantCount: (jobId: string) => number
  getApplicantsForJob: (jobId: string) => ApplicantRecord[]

  userLat: number | null
  userLng: number | null
  userInsideCity: boolean | null
  locMode: 'gps' | 'pin'
  setUserLocation: (
    lat: number,
    lng: number,
    inside: boolean,
    mode: 'gps' | 'pin'
  ) => void
  clearUserLocation: () => void

  navigate: (page: Page, jobId?: string | null) => void
  setSearchQuery: (query: string) => void

  allJobs: Job[]
  jobsLoading: boolean
  jobsError: string | null
  reloadJobs: () => Promise<void>

  /** Ontology-based SkillMatchScore S(a,j), in the range [0,1]. */
  calculateSkillMatchScore: (job: Job) => number

  /** Composite MatchScore = 0.70*S(a,j) + 0.30*G(a,j). */
  calculateMatchScore: (
    job: Job,
    userLat?: number,
    userLng?: number
  ) => Promise<number>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('home')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [prevPage, setPrevPage] = useState<Page | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Public mode has no browser-side identity. This preserves the matching API
  // without reintroducing plaintext localStorage credentials or fake sessions.
  const [user] = useState<User | null>(null)

  const employer: Employer | null = null
  const savedJobIds: string[] = []
  const applications: Application[] = []
  const postedJobs: Job[] = []
  const employerJobs: EmployerJob[] = []
  const allApplicants: ApplicantRecord[] = []

  // These no-op actions exist only so legacy, unreferenced modules continue to
  // type-check. Public navigation cannot render those modules.
  const setUser = (_user: User | null) => undefined
  const setEmployer = (_employer: Employer | null) => undefined
  const toggleSave = (_jobId: string) => undefined
  const addApplication = (_application: Application) => undefined
  const addPostedJob = (_job: Job) => undefined
  const addEmployerJob = (_job: EmployerJob) => undefined
  const updateEmployerJob = (
    _id: string,
    _updates: Partial<EmployerJob>
  ) => undefined
  const updateApplicantStatus = (
    _id: string,
    _status: ApplicantRecord['status']
  ) => undefined
  const updateEmployer = (_updates: Partial<Employer>) => undefined
  const updateUser = (_updates: Partial<User>) => undefined
  const hasApplied = (_jobId: string) => false
  const getApplicantCount = (_jobId: string) => 0
  const getApplicantsForJob = (_jobId: string): ApplicantRecord[] => []

  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)

  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [userInsideCity, setUserInsideCity] = useState<boolean | null>(null)
  const [locMode, setLocMode] = useState<'gps' | 'pin'>('gps')

  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    setJobsLoading(true)
    setJobsError(null)

    try {
      const jobs = await fetchPublicJobs(signal)
      setAllJobs(jobs)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return

      setAllJobs([])
      setJobsError(
        error instanceof Error
          ? error.message
          : 'The job catalogue could not be loaded.'
      )
    } finally {
      if (!signal?.aborted) setJobsLoading(false)
    }
  }, [])

  useEffect(() => {
    clearLegacyBrowserDataOnce()

    const controller = new AbortController()
    void loadJobs(controller.signal)
    return () => controller.abort()
  }, [loadJobs])

  const reloadJobs = useCallback(() => loadJobs(), [loadJobs])

  const setUserLocation = (
    lat: number,
    lng: number,
    inside: boolean,
    mode: 'gps' | 'pin'
  ) => {
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
    const publicPage = PUBLIC_PAGES.has(newPage) ? newPage : 'home'
    setPrevPage(page)
    setPage(publicPage)
    if (publicPage === 'jobdetail' && jobId !== undefined) {
      setSelectedJobId(jobId ?? null)
    }
    window.scrollTo(0, 0)
  }

  // Matching remains implemented for future server-backed profiles and for the
  // thesis algorithm. Public visitors currently have no persisted skill set.
  const calculateSkillMatchScore = (job: Job): number => {
    if (!user) return 0
    const required = job.requiredSkills?.length
      ? job.requiredSkills
      : job.skills ?? []
    return skillMatchScore(required, user.skills)
  }

  const calculateMatchScore = async (
    job: Job,
    latitude?: number,
    longitude?: number
  ): Promise<number> => {
    if (!user) return 0

    const skillScore = calculateSkillMatchScore(job)
    let distanceScore = 0

    if (
      latitude != null &&
      longitude != null &&
      job.lat != null &&
      job.lng != null
    ) {
      distanceScore = await computeDijkstraDistanceScore(
        latitude,
        longitude,
        job.lat,
        job.lng
      )
    }

    return computeMatchScore(skillScore, distanceScore)
  }

  return (
    <AppContext.Provider
      value={{
        page,
        selectedJobId,
        prevPage,
        user,
        employer,
        searchQuery,
        savedJobIds,
        applications,
        postedJobs,
        employerJobs,
        allApplicants,
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
        hasApplied,
        getApplicantCount,
        getApplicantsForJob,
        userLat,
        userLng,
        userInsideCity,
        locMode,
        setUserLocation,
        clearUserLocation,
        navigate,
        setSearchQuery,
        allJobs,
        jobsLoading,
        jobsError,
        reloadJobs,
        calculateSkillMatchScore,
        calculateMatchScore,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
