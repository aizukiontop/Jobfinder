import type { Page } from '../types'

export type Audience = 'public' | 'job-seeker' | 'employer' | 'admin'

const ACCESS: Record<Page, Audience> = {
  home: 'public',
  search: 'public',
  jobdetail: 'public',
  signin: 'public',
  register: 'public',
  forgot: 'public',
  reset: 'public',

  saved: 'job-seeker',
  applications: 'job-seeker',
  profile: 'job-seeker',
  apply: 'job-seeker',
  postjob: 'job-seeker',

  'employer-dashboard': 'employer',
  'employer-jobs': 'employer',
  'employer-post': 'employer',
  'employer-applicants': 'employer',
  'employer-profile': 'employer',

  admin: 'admin',
}

export function audienceFor(page: Page): Audience {
  return ACCESS[page] ?? 'public'
}

export interface Viewer {
  isSeeker: boolean
  isEmployer: boolean
  isAdmin: boolean
}

export type AccessResult =
  | { allowed: true }
  | { allowed: false; reason: 'signed-out' | 'wrong-role'; audience: Audience }

export function checkAccess(page: Page, viewer: Viewer): AccessResult {
  const audience = audienceFor(page)
  if (audience === 'public') return { allowed: true }

  const signedIn = viewer.isSeeker || viewer.isEmployer
  if (!signedIn) return { allowed: false, reason: 'signed-out', audience }

  if (audience === 'admin' && !viewer.isAdmin) {
    return { allowed: false, reason: 'wrong-role', audience }
  }
  if (audience === 'job-seeker' && !viewer.isSeeker) {
    return { allowed: false, reason: 'wrong-role', audience }
  }
  if (audience === 'employer' && !viewer.isEmployer) {
    return { allowed: false, reason: 'wrong-role', audience }
  }

  return { allowed: true }
}

/** Where a viewer belongs when they land somewhere they cannot use. */
export function homePageFor(viewer: Viewer): Page {
  return viewer.isEmployer ? 'employer-dashboard' : 'home'
}
