import type { Job } from '../types'

type PostingState = Pick<Job, 'status' | 'reviewStatus'>

export function postingStatusLabel(job: PostingState): string {
  if (job.status === 'draft') return 'Draft'
  if (job.status === 'closed') return 'Closed / archived'
  if (job.reviewStatus === 'pending') return 'Pending review'
  if (job.reviewStatus === 'rejected') return 'Changes requested / rejected'
  if (job.reviewStatus === 'suspended') return 'Suspended'
  if (job.reviewStatus === 'approved') return 'Approved · Published'
  return 'Existing posting · Published'
}

export function isPostingPublic(job: PostingState): boolean {
  return job.status === 'active' && (!job.reviewStatus || job.reviewStatus === 'legacy' || job.reviewStatus === 'approved')
}

export default function PostingReviewStatus({ job }: { job: PostingState }) {
  const colors = isPostingPublic(job)
    ? 'bg-green-100 text-green-800'
    : job.reviewStatus === 'rejected' || job.reviewStatus === 'suspended'
      ? 'bg-red-50 text-red-700'
      : 'bg-amber-50 text-amber-800'
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>{postingStatusLabel(job)}</span>
}
