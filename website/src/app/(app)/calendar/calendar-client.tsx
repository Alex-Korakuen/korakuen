'use client'

import { useRouter } from 'next/navigation'
import { useUrlFilters } from '@/lib/use-url-filters'
import { getCalendarBucket } from '@/lib/date-utils'
import { FK } from '@/lib/filter-keys'
import { SummaryCard } from '@/components/ui/summary-card'
import { CalendarFilters } from './calendar-filters'
import { CalendarTable } from './calendar-table'
import { getDaysUntilEndOfWeek } from './helpers'
import type {
  ObligationCalendarRow,
  CalendarBucketId as BucketId,
  CalendarBucketCounts as BucketCounts,
} from '@/lib/types'

type Props = {
  data: ObligationCalendarRow[]
  bucketCounts: BucketCounts
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  currentFilters: {
    direction: string
    type: string
    projectId: string
    entity: string
    currency: string
    search: string
    bucket: string
  }
}

type ActiveCard = { bucket: BucketId; side: 'pay' | 'collect' } | null

const BUCKET_ORDER: { id: Exclude<BucketId, 'all'>; label: string; variant: 'overdue' | 'today' | 'this-week' | 'future' }[] = [
  { id: 'overdue', label: 'Overdue', variant: 'overdue' },
  { id: 'today', label: 'Due Today', variant: 'today' },
  { id: 'this-week', label: 'This Week', variant: 'this-week' },
  { id: 'next-30', label: 'Next 30 Days', variant: 'future' },
]

export function CalendarClient({
  data,
  bucketCounts,
  projects,
  uniqueEntities,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { setFilter, setFilters, clearFilters } = useUrlFilters()

  // Derive active card state from URL filters
  const activeCard: ActiveCard = (() => {
    const b = currentFilters.bucket
    const d = currentFilters.direction
    if (b && b !== 'all' && (d === 'payable' || d === 'receivable')) {
      return { bucket: b as BucketId, side: d === 'payable' ? 'pay' : 'collect' }
    }
    return null
  })()

  function handleCardClick(bucket: BucketId, side: 'pay' | 'collect') {
    // Toggle: if same card+side is active, clear both; otherwise set both
    if (activeCard?.bucket === bucket && activeCard?.side === side) {
      setFilters({ bucket: '', direction: '' })
    } else {
      setFilters({
        bucket,
        direction: side === 'pay' ? 'payable' : 'receivable',
      })
    }
  }

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

  // Group rows by urgency bucket
  const daysToEndOfWeek = getDaysUntilEndOfWeek()
  const groups = BUCKET_ORDER.map(({ id, label }) => ({
    id,
    label,
    rows: data.filter(r => getCalendarBucket(r.days_remaining, daysToEndOfWeek) === id),
  }))

  return (
    <div>
      <div className="mt-0">
        {/* Summary Cards */}
        <div className="flex flex-wrap gap-4">
          {BUCKET_ORDER.map(({ id, label, variant }) => (
            <SummaryCard
              key={id}
              title={label}
              pay={bucketCounts[id].pay}
              collect={bucketCounts[id].collect}
              variant={variant}
              activeSide={activeCard?.bucket === id ? activeCard.side : null}
              onClickPay={() => handleCardClick(id, 'pay')}
              onClickCollect={() => handleCardClick(id, 'collect')}
            />
          ))}
        </div>

        <CalendarFilters
          currentFilters={currentFilters}
          setFilter={setFilter}
          projects={projects}
          uniqueEntities={uniqueEntities}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />

        <CalendarTable groups={groups} onRowClick={handleRowClick} />
      </div>
    </div>
  )
}
