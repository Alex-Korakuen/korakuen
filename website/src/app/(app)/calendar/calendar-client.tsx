'use client'

import { useRouter } from 'next/navigation'
import { useUrlFilters } from '@/lib/use-url-filters'
import { getCalendarBucket } from '@/lib/date-utils'
import { FK } from '@/lib/filter-keys'
import { CalendarFilters } from './calendar-filters'
import { CalendarTable } from './calendar-table'
import type {
  ObligationCalendarRow,
  CalendarBucketId as BucketId,
} from '@/lib/types'

export type SectionTotals = {
  pay: { pen: number; usd: number; count: number }
  collect: { pen: number; usd: number; count: number }
}

type Props = {
  data: ObligationCalendarRow[]
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  currentFilters: {
    type: string
    projectId: string
    entity: string
    currency: string
    search: string
  }
}

const BUCKET_ORDER: { id: Exclude<BucketId, 'all'>; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'next-7', label: 'Next 7 Days' },
  { id: 'next-30', label: 'Next 30 Days' },
  { id: 'later', label: 'Later' },
]

function computeTotals(rows: ObligationCalendarRow[]): SectionTotals {
  const totals: SectionTotals = {
    pay: { pen: 0, usd: 0, count: 0 },
    collect: { pen: 0, usd: 0, count: 0 },
  }
  for (const r of rows) {
    const side = r.direction === 'receivable' ? totals.collect : totals.pay
    side.count++
    const amt = r.outstanding ?? 0
    if (r.currency === 'USD') side.usd += amt
    else side.pen += amt
  }
  return totals
}

export function CalendarClient({
  data,
  projects,
  uniqueEntities,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { setFilter, clearFilters } = useUrlFilters()

  const hasActiveFilters =
    currentFilters.projectId !== '' ||
    currentFilters.entity !== '' ||
    currentFilters.type !== '' ||
    currentFilters.currency !== '' ||
    currentFilters.search !== ''

  const handleClearFilters = () => clearFilters([FK.project, FK.entity, FK.type, FK.currency, FK.search])

  const handleRowClick = (row: ObligationCalendarRow) => {
    const params = new URLSearchParams()
    params.set('direction', row.direction ?? 'payable')
    if (row.type === 'loan') params.set('type', 'loan')
    else params.set('type', 'commercial')
    if (row.entity_name) params.set('entity', row.entity_name)
    router.push(`/invoices?${params.toString()}`)
  }

  // Group rows by urgency bucket and compute totals per section
  const groups = BUCKET_ORDER.map(({ id, label }) => {
    const rows = data.filter(r => getCalendarBucket(r.days_remaining) === id)
    return { id, label, rows, totals: computeTotals(rows) }
  })

  const grandTotals = computeTotals(data)

  return (
    <div className="pb-16">
      <CalendarFilters
        currentFilters={currentFilters}
        setFilter={setFilter}
        projects={projects}
        uniqueEntities={uniqueEntities}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      <CalendarTable groups={groups} grandTotals={grandTotals} onRowClick={handleRowClick} />
    </div>
  )
}
