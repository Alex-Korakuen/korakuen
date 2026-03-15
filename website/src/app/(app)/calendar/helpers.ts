const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format date as "15/Mar" for the calendar timeline. */
export function formatCalendarDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}/${SHORT_MONTHS[d.getMonth()]}`
}

/** Human-readable urgency label: "7d late", "due today", "in 3d", etc. */
export function formatUrgency(daysRemaining: number | null): string {
  if (daysRemaining === null) return ''
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d late`
  if (daysRemaining === 0) return 'due today'
  if (daysRemaining === 1) return 'tomorrow'
  return `in ${daysRemaining}d`
}

/** Urgency label text color class. */
export function getUrgencyColor(daysRemaining: number | null): string {
  if (daysRemaining === null) return 'text-zinc-400'
  if (daysRemaining < 0) return 'text-red-600 font-medium'
  if (daysRemaining === 0) return 'text-orange-600 font-medium'
  return 'text-zinc-500'
}

/** Color classes for section headers by bucket. */
export function getSectionColors(bucket: string): { border: string; text: string; bg: string } {
  switch (bucket) {
    case 'overdue':
      return { border: 'border-red-400', text: 'text-red-700', bg: 'bg-red-50' }
    case 'today':
      return { border: 'border-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' }
    case 'next-7':
      return { border: 'border-blue-400', text: 'text-blue-700', bg: 'bg-blue-50' }
    case 'next-30':
      return { border: 'border-violet-400', text: 'text-violet-700', bg: 'bg-violet-50' }
    case 'later':
      return { border: 'border-zinc-300', text: 'text-zinc-600', bg: 'bg-zinc-50' }
    default:
      return { border: 'border-zinc-200', text: 'text-zinc-500', bg: 'bg-zinc-50' }
  }
}
