import { formatCurrency, formatDate } from '@/lib/formatters'
import { formatUrgency, getUrgencyColor, getSectionColors } from './helpers'
import type { ObligationCalendarRow, CalendarBucketId } from '@/lib/types'

type BucketGroup = {
  id: Exclude<CalendarBucketId, 'all'>
  label: string
  rows: ObligationCalendarRow[]
}

type Props = {
  groups: BucketGroup[]
  onRowClick: (row: ObligationCalendarRow) => void
}

function DirectionBadge({ direction }: { direction: string | null }) {
  if (direction === 'receivable') {
    return (
      <span className="inline-flex w-7 items-center justify-center rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
        AR
      </span>
    )
  }
  return (
    <span className="inline-flex w-7 items-center justify-center rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-orange-50 text-orange-700">
      AP
    </span>
  )
}

function TypeIcon({ type }: { type: string | null }) {
  return <span className="text-sm">{type === 'loan' ? '\uD83C\uDFE6' : '\uD83D\uDCC4'}</span>
}

function SectionHeader({ bucket, label, count }: { bucket: string; label: string; count: number }) {
  const colors = getSectionColors(bucket)
  return (
    <div className="flex items-center gap-3 pt-6 pb-2 first:pt-0">
      <div className={`h-0.5 w-6 ${colors.border} border-t-2`} />
      <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
        {label}
      </span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
        {count}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  )
}

export function CalendarTable({ groups, onRowClick }: Props) {
  const hasAnyRows = groups.some(g => g.rows.length > 0)

  if (!hasAnyRows) {
    return (
      <div className="mt-6 rounded-lg border border-zinc-200 px-4 py-8 text-center text-zinc-400">
        No obligations found
      </div>
    )
  }

  return (
    <div className="mt-4">
      {groups.map(
        (group) =>
          group.rows.length > 0 && (
            <div key={group.id}>
              <SectionHeader bucket={group.id} label={group.label} count={group.rows.length} />
              <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
                {group.rows.map((row) => (
                  <div
                    key={row.invoice_id ?? `loan-${row.loan_id ?? row.entity_name}-${row.due_date}`}
                    className="grid cursor-pointer grid-cols-[80px_30px_24px_1fr_64px_auto_72px] items-center gap-x-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
                    onClick={() => onRowClick(row)}
                  >
                    {/* Date */}
                    <span className="text-sm text-zinc-600">
                      {row.due_date ? formatDate(row.due_date) : '--'}
                    </span>

                    {/* Direction badge */}
                    <DirectionBadge direction={row.direction} />

                    {/* Type icon */}
                    <TypeIcon type={row.type} />

                    {/* Entity name — "Loan: BCP" for loans */}
                    <span className="truncate text-sm text-zinc-800">
                      {row.type === 'loan' ? `Loan: ${row.entity_name ?? '--'}` : row.entity_name ?? '--'}
                    </span>

                    {/* Project code */}
                    <span className="font-mono text-xs text-zinc-500">
                      {row.project_code ?? '--'}
                    </span>

                    {/* Outstanding amount */}
                    <span className="text-right font-mono text-sm font-medium text-zinc-900">
                      {row.outstanding !== null && row.currency
                        ? formatCurrency(row.outstanding, row.currency)
                        : '--'}
                    </span>

                    {/* Urgency label */}
                    <span className={`text-right text-xs ${getUrgencyColor(row.days_remaining)}`}>
                      {formatUrgency(row.days_remaining)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  )
}
