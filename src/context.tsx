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

import * as api from './lib/api'
import { skillMatchScore } from './lib/skillMatch'
import { explainSkillMatch, type SkillMatchDetail } from './lib/ontology'
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

const STORAGE_CLEANUP_MARKER = 'jobfinder_server_backed_cleanup_v1'

function clearLegacyBrowserDataOnce() {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(STORAGE_CLEANUP_MARKER)) return
    for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key)
    window.localStorage.setItem(STORAGE_CLEANUP_MARKER, 'complete')
  } catch {
  }
}

function toUser(profile: any): User {
  return {
    id: profile.id,
    email: profile.email,
    password: '',
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    headline: profile.headline ?? '',
    photo: profile.photo ?? '',
    skills: profile.skills ?? [],
    preferredLocation: profile.preferredLocation ?? '',
    preferredEmploymentType: profile.preferredEmploymentType ?? '',
    careerCategory: profile.careerCategory ?? '',
    education: profile.education ?? '',
    experienceLevel: profile.experienceLevel ?? '',
    resumeName: profile.resumeName ?? '',
    resumeDate: profile.resumeDate ?? '',
    role: 'job-seeker',
    barangay: profile.barangay ?? null,
    lat: profile.lat ?? null,
    lng: profile.lng ?? null,
  }
}

function toEmployer(profile: any): Employer {
  return {
    id: profile.id,
    email: profile.email,
    password: '',
    contactName: profile.contactName ?? '',
    companyName: profile.companyName ?? '',
    industry: profile.industry ?? '',
    description: profile.description ?? '',
    address: profile.address ?? '',
    contactEmail: profile.contactEmail ?? profile.email,
    contactPhone: profile.contactPhone ?? '',
    website: profile.website ?? '',
    companySize: profile.companySize ?? '',
  }
}

function toEmployerJob(dto: any): EmployerJob {
  return {
    id: dto.id,
    employerId: dto.postedBy ?? '',
    title: dto.title ?? '',
    company: dto.company ?? '',
    category: dto.category ?? '',
    description: dto.description ?? '',
    requirements: Array.isArray(dto.requirements)
      ? dto.requirements.join('\n')
      : dto.requirements ?? '',
    employmentType: dto.employmentType ?? '',
    workArrangement: dto.workArrangement ?? '',
    location: dto.location ?? '',
    city: dto.city ?? '',
    barangay: dto.barangay ?? null,
    address: dto.address ?? '',
    salary: dto.salary ?? '',
    salaryMin: dto.salaryMin ?? 0,
    salaryMax: dto.salaryMax ?? 0,
    openings: dto.openings ?? 1,
    deadline: dto.expirationDate ?? '',
    status: dto.status ?? 'draft',
    postedDate: dto.datePosted ?? '',
    daysAgo: dto.daysAgo ?? 0,
    applicantCount: dto.applicantCount ?? 0,
    requiredSkills: dto.requiredSkills ?? [],
    preferredSkills: dto.preferredSkills ?? [],
    skills: dto.skills ?? dto.requiredSkills ?? [],
    experienceLevel: dto.experienceLevel ?? '',
    lat: dto.lat ?? undefined,
    lng: dto.lng ?? undefined,
    coordinateSource: dto.coordinateSource ?? undefined,
  }
}

function toApplicantRecord(dto: any): ApplicantRecord {
  return {
    id: dto.id,
    jobId: dto.jobId,
    jobTitle: dto.jobTitle ?? '',
    applicantName: dto.applicantName ?? `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim(),
    applicantEmail: dto.applicantEmail ?? dto.email ?? '',
    appliedDate: dto.dateApplied ?? '',
    matchScore: dto.matchScorePercent ?? dto.matchScore ?? 0,
    status: dto.status ?? 'applied',
    phone: dto.phone ?? '',
    coverLetter: dto.coverLetter ?? '',
    resumeName: dto.resumeName ?? '',
    applicantSkills: dto.applicantSkills ?? [],
  }
}

interface AppState {
  page: Page
  selectedJobId: string | null
  prevPage: Page | null

  user: User | null
  employer: Employer | null
  searchQuery: string

  savedJobIds: string[]
  applications: Application[]
  postedJobs: Job[]
  employerJobs: EmployerJob[]
  allApplicants: ApplicantRecord[]

  sessionLoading: boolean
  resetToken: string | null

  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<'job-seeker' | 'employer'>
  signUp: (
    input: api.SeekerRegistration | api.EmployerRegistration
  ) => Promise<'job-seeker' | 'employer'>
  signOut: () => Promise<void>

  setUser: (user: User | null) => void
  setEmployer: (employer: Employer | null) => void
  toggleSave: (jobId: string) => Promise<boolean>
  submitApplication: (jobId: string, input: api.ApplicationInput) => Promise<Application>
  addApplication: (application: Application) => void
  addPostedJob: (job: Job) => void
  addEmployerJob: (job: EmployerJob) => void
  updateEmployerJob: (id: string, updates: Partial<EmployerJob>) => Promise<boolean>
  updateApplicantStatus: (id: string, status: ApplicantRecord['status']) => Promise<boolean>
  updateEmployer: (updates: Partial<Employer>) => Promise<boolean>
  updateUser: (updates: Partial<User>) => Promise<boolean>
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
  actionError: string | null
  dismissActionError: () => void
  reloadJobs: () => Promise<void>

  /** Ontology-based SkillMatchScore S(a,j), in the range [0,1]. */
  calculateSkillMatchScore: (job: Job) => number

  /**
   * Per-requirement ontology breakdown — re-exposes the same BFS values that
   * produce calculateSkillMatchScore(). Used for the explainability UI only.
   * Does NOT affect SkillMatchScore or MatchScore in any way.
   */
  getSkillBreakdown: (job: Job) => SkillMatchDetail[]

  /** Composite MatchScore = 0.70*S(a,j) + 0.30*G(a,j). */
  calculateMatchScore: (
    job: Job,
    userLat?: number,
    userLng?: number
  ) => Promise<number>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const initialReset =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('reset')

  const [resetToken] = useState<string | null>(initialReset)
  const [page, setPage] = useState<Page>(initialReset ? 'reset' : 'home')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [prevPage, setPrevPage] = useState<Page | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [user, setUserState] = useState<User | null>(null)
  const [employer, setEmployerState] = useState<Employer | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [savedJobIds, setSavedJobIds] = useState<string[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [employerJobs, setEmployerJobs] = useState<EmployerJob[]>([])
  const [allApplicants, setAllApplicants] = useState<ApplicantRecord[]>([])

  const postedJobs: Job[] = []

  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [userInsideCity, setUserInsideCity] = useState<boolean | null>(null)
  const [locMode, setLocMode] = useState<'gps' | 'pin'>('gps')

  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    setJobsLoading(true)
    setJobsError(null)
    try {
      setAllJobs(await api.fetchPublicJobs(signal))
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

  const reloadJobs = useCallback(() => loadJobs(), [loadJobs])

  useEffect(() => {
    if (initialReset && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('reset')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [initialReset])

  useEffect(() => {
    clearLegacyBrowserDataOnce()
    const controller = new AbortController()
    void loadJobs(controller.signal)
    return () => controller.abort()
  }, [loadJobs])

  const loadSeekerData = useCallback(async (signal?: AbortSignal) => {
    const [ids, apps] = await Promise.all([
      api.fetchSavedJobIds(signal),
      api.fetchMyApplications(signal),
    ])
    setSavedJobIds(ids)
    setApplications(apps)
  }, [])

  const loadEmployerData = useCallback(async (signal?: AbortSignal) => {
    const [jobs, applicants] = await Promise.all([
      api.fetchEmployerJobs(signal),
      api.fetchEmployerApplications({}, signal),
    ])
    setEmployerJobs(jobs.map(toEmployerJob))
    setAllApplicants(applicants.map(toApplicantRecord))
  }, [])

  const adoptSession = useCallback(
    async (session: api.SessionResponse | null, signal?: AbortSignal) => {
      if (!session) {
        setUserState(null)
        setEmployerState(null)
        setSavedJobIds([])
        setApplications([])
        setEmployerJobs([])
        setAllApplicants([])
        return
      }

      if (session.account.role === 'job-seeker') {
        setUserState(toUser(session.profile))
        setEmployerState(null)
        await loadSeekerData(signal)
      } else {
        setEmployerState(toEmployer(session.profile))
        setUserState(null)
        await loadEmployerData(signal)
      }
    },
    [loadSeekerData, loadEmployerData]
  )

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        await adoptSession(await api.fetchSession(controller.signal), controller.signal)
      } catch {
      } finally {
        if (!controller.signal.aborted) setSessionLoading(false)
      }
    })()
    return () => controller.abort()
  }, [adoptSession])

  const signIn = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      const session = await api.login(email, password, rememberMe)
      await adoptSession(session)
      return session.account.role
    },
    [adoptSession]
  )

  const signUp = useCallback(
    async (input: api.SeekerRegistration | api.EmployerRegistration) => {
      const session = await api.register(input)
      await adoptSession(session)
      return session.account.role
    },
    [adoptSession]
  )

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      await adoptSession(null)
    }
  }, [adoptSession])

  const setUser = (next: User | null) => {
    if (next === null) void signOut()
    else setUserState(next)
  }

  const setEmployer = (next: Employer | null) => {
    if (next === null) void signOut()
    else setEmployerState(next)
  }

  const runAction = async (action: () => Promise<void>): Promise<boolean> => {
    try {
      await action()
      setActionError(null)
      return true
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'That action could not be completed.'
      )
      return false
    }
  }

  const toggleSave = (jobId: string) => {
    if (!user) {
      navigate('signin')
      return Promise.resolve(false)
    }

    return runAction(async () => {
      if (savedJobIds.includes(jobId)) {
        await api.unsaveJob(jobId)
        setSavedJobIds(prev => prev.filter(id => id !== jobId))
      } else {
        await api.saveJob(jobId)
        setSavedJobIds(prev => [jobId, ...prev])
      }
    })
  }

  const submitApplication = async (
    jobId: string,
    input: api.ApplicationInput
  ): Promise<Application> => {
    const application = await api.applyToJob(jobId, input)
    setApplications(prev => [application, ...prev])
    return application
  }

  const addApplication = (application: Application) => {
    setApplications(prev =>
      prev.some(a => a.id === application.id) ? prev : [application, ...prev]
    )
  }

  const addPostedJob = (_job: Job) => {
    void reloadJobs()
  }

  const addEmployerJob = (job: EmployerJob) => {
    setEmployerJobs(prev => [job, ...prev])
  }

  const updateEmployerJob = (id: string, updates: Partial<EmployerJob>) =>
    runAction(async () => {
      const job = await api.updateEmployerJob(id, updates as Record<string, unknown>)
      setEmployerJobs(prev =>
        prev.map(j =>
          j.id === id ? { ...toEmployerJob(job), applicantCount: j.applicantCount } : j
        )
      )
      if (updates.status) await reloadJobs()
    })

  const updateApplicantStatus = (id: string, status: ApplicantRecord['status']) =>
    runAction(async () => {
      await api.updateApplicationStatus(id, status)
      setAllApplicants(prev => prev.map(a => (a.id === id ? { ...a, status } : a)))
    })

  const updateUser = (updates: Partial<User>) =>
    runAction(async () => {
      const profile = await api.updateProfile(updates)
      setUserState(toUser(profile))
    })

  const updateEmployer = (updates: Partial<Employer>) =>
    runAction(async () => {
      const profile = await api.updateProfile(updates)
      setEmployerState(toEmployer(profile))
    })

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

  function navigate(newPage: Page, jobId?: string | null) {
    setPrevPage(page)
    setPage(newPage)
    if (jobId !== undefined) setSelectedJobId(jobId ?? null)
    window.scrollTo(0, 0)
  }

  const calculateSkillMatchScore = (job: Job): number => {
    if (!user) return 0
    const required = job.requiredSkills?.length ? job.requiredSkills : job.skills ?? []
    return skillMatchScore(required, user.skills)
  }

  const getSkillBreakdown = (job: Job): SkillMatchDetail[] => {
    if (!user) return []
    const required = job.requiredSkills?.length ? job.requiredSkills : job.skills ?? []
    return explainSkillMatch(required, user.skills)
  }

  const calculateMatchScore = async (
    job: Job,
    lat?: number,
    lng?: number
  ): Promise<number> => {
    if (!user) return 0

    // S(a,j) — ontology-based skill match (synchronous)
    const S = calculateSkillMatchScore(job)

    // G(a,j) — Dijkstra shortest-path geographic accessibility (async)
    // Thesis §Method (p.25): DistanceScore = 1/(1 + shortestPathKm/14.9434)
    let G = 0
    if (lat != null && lng != null && job.lat && job.lng) {
      G = await computeDijkstraDistanceScore(lat, lng, job.lat, job.lng)
    }

    // MatchScore = α×S + β×G  (α=0.70, β=0.30)
    return computeMatchScore(S, G)
  }

  const hasApplied = (jobId: string) => applications.some(app => app.jobId === jobId)

  const getApplicantCount = (jobId: string) => {
    const job = employerJobs.find(j => j.id === jobId)
    if (job) return job.applicantCount
    return allApplicants.filter(a => a.jobId === jobId).length
  }

  const getApplicantsForJob = (jobId: string): ApplicantRecord[] =>
    allApplicants
      .filter(a => a.jobId === jobId)
      .sort((a, b) => b.matchScore - a.matchScore)

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
        employerJobs,
        allApplicants,
        searchQuery,
        sessionLoading,
        resetToken,
        signIn,
        signUp,
        signOut,
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
        submitApplication,
        addApplication,
        addPostedJob,
        addEmployerJob,
        updateEmployerJob,
        updateApplicantStatus,
        updateEmployer,
        updateUser,
        setSearchQuery,
        allJobs,
        jobsLoading,
        jobsError,
        actionError,
        dismissActionError: () => setActionError(null),
        reloadJobs,
        calculateSkillMatchScore,
        getSkillBreakdown,
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
