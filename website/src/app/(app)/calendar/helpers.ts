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
  if (daysRemaining === null) return 'text-faint'
  if (daysRemaining < 0) return 'text-negative font-medium'
  if (daysRemaining === 0) return 'text-caution font-medium'
  return 'text-muted'
}

/** Color classes for section headers by bucket. */
export function getSectionColors(bucket: string): { border: string; text: string; bg: string } {
  switch (bucket) {
    case 'overdue':
      return { border: 'border-negative', text: 'text-negative', bg: 'bg-negative-bg' }
    case 'today':
      return { border: 'border-caution', text: 'text-caution', bg: 'bg-caution-bg' }
    case 'next-7':
      return { border: 'border-info', text: 'text-info', bg: 'bg-info-bg' }
    case 'next-30':
      return { border: 'border-later', text: 'text-later', bg: 'bg-later-bg' }
    case 'later':
      return { border: 'border-edge-strong', text: 'text-muted', bg: 'bg-panel' }
    default:
      return { border: 'border-edge', text: 'text-muted', bg: 'bg-panel' }
  }
}
