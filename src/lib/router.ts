import type { Page } from '../types'

export interface Route {
  page: Page
  jobId: string | null
}

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '')

/** Pages whose address never carries an id. */
const STATIC_PATHS: Array<[Page, string]> = [
  ['home', '/'],
  ['search', '/search'],
  ['saved', '/saved'],
  ['applications', '/applications'],
  ['signin', '/signin'],
  ['register', '/register'],
  ['forgot', '/forgot-password'],
  ['reset', '/reset-password'],
  ['profile', '/profile'],
  ['admin', '/admin'],
  ['employer-dashboard', '/employer'],
  ['employer-jobs', '/employer/jobs'],
  ['employer-profile', '/employer/profile'],
]

const PAGE_TO_PATH = new Map<Page, string>(STATIC_PATHS)
const PATH_TO_PAGE = new Map<string, Page>(STATIC_PATHS.map(([page, path]) => [path, page]))

export function routeToPath(page: Page, jobId: string | null): string {
  let path: string

  if (page === 'jobdetail') {
    path = jobId ? `/jobs/${encodeURIComponent(jobId)}` : '/search'
  } else if (page === 'apply') {
    path = jobId ? `/jobs/${encodeURIComponent(jobId)}/apply` : '/search'
  } else if (page === 'employer-post') {
    path = jobId ? `/employer/post/${encodeURIComponent(jobId)}` : '/employer/post'
  } else if (page === 'employer-applicants') {
    path = jobId ? `/employer/applicants/${encodeURIComponent(jobId)}` : '/employer/applicants'
  } else {
    path = PAGE_TO_PATH.get(page) ?? '/'
  }

  return `${BASE}${path}` || '/'
}

export function pathToRoute(pathname: string): Route {
  let path = pathname
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length)
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1) path = path.replace(/\/+$/, '')

  const jobDetail = /^\/jobs\/([^/]+)$/.exec(path)
  if (jobDetail) return { page: 'jobdetail', jobId: decodeURIComponent(jobDetail[1]) }

  const jobApply = /^\/jobs\/([^/]+)\/apply$/.exec(path)
  if (jobApply) return { page: 'apply', jobId: decodeURIComponent(jobApply[1]) }

  const employerPost = /^\/employer\/post(?:\/([^/]+))?$/.exec(path)
  if (employerPost) {
    return { page: 'employer-post', jobId: employerPost[1] ? decodeURIComponent(employerPost[1]) : null }
  }

  const employerApplicants = /^\/employer\/applicants(?:\/([^/]+))?$/.exec(path)
  if (employerApplicants) {
    return { page: 'employer-applicants', jobId: employerApplicants[1] ? decodeURIComponent(employerApplicants[1]) : null }
  }

  const page = PATH_TO_PAGE.get(path)
  return { page: page ?? 'home', jobId: null }
}
