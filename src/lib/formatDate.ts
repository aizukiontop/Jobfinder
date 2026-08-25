export function formatRelativeDate(value: string): string {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 2) return 'Just now'
  if (minutes < 60) return `${minutes} minutes ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
