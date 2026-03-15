'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { formatCalendarDate, formatUrgency, getUrgencyColor, getSectionColors } from './helpers'
import type { SectionTotals } from './calendar-client'
import type { ObligationCalendarRow, CalendarBucketId } from '@/lib/types'

type BucketGroup = {
  id: Exclude<CalendarBucketId, 'all'>
  label: string
  rows: ObligationCalendarRow[]
  totals: SectionTotals
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

/** Format a dual-currency total: "S/ 5,000.00  $1,200.00" or just one if the other is zero. */
function DualAmount({ pen, usd }: { pen: number; usd: number }) {
  if (pen === 0 && usd === 0) return <span className="text-zinc-400">--</span>
  return (
    <span className="font-mono text-xs">
      {pen > 0 && formatCurrency(pen, 'PEN')}
      {pen > 0 && usd > 0 && <span className="mx-1 text-zinc-300">|</span>}
      {usd > 0 && formatCurrency(usd, 'USD')}
    </span>
  )
}

function SectionHeader({
  bucket, label, totals, open, onToggle,
}: {
  bucket: string; label: string; totals: SectionTotals; open: boolean; onToggle: () => void
}) {
  const colors = getSectionColors(bucket)
  const totalCount = totals.pay.count + totals.collect.count
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full cursor-pointer items-center gap-x-3 pb-3"
    >
      <div className={`w-0.5 self-stretch ${colors.border} border-l-2`} />
      <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
        {label}
      </span>
      <div className="h-px w-3 bg-zinc-200" />

      {/* Pay total */}
      {totals.pay.count > 0 && (
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="font-medium text-orange-600">Pay</span>
          <DualAmount pen={totals.pay.pen} usd={totals.pay.usd} />
        </span>
      )}

      {/* Collect total */}
      {totals.collect.count > 0 && (
        <>
          <div className="h-px w-3 bg-zinc-200" />
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="font-medium text-emerald-600">Collect</span>
            <DualAmount pen={totals.collect.pen} usd={totals.collect.usd} />
          </span>
        </>
      )}

      <div className="h-px w-3 bg-zinc-200" />
      <span className="text-[10px] text-zinc-400">
        {totalCount} {totalCount === 1 ? 'item' : 'items'}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />

      {/* Chevron */}
      <svg
        className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? '' : '-rotate-90'}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

function Section({ group, onRowClick }: { group: BucketGroup; onRowClick: (row: ObligationCalendarRow) => void }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mt-6 first:mt-0">
      <SectionHeader
        bucket={group.id}
        label={group.label}
        totals={group.totals}
        open={open}
        onToggle={() => setOpen(o => !o)}
      />
      {open && (
        <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {group.rows.map((row) => (
            <div
              key={row.invoice_id ?? `loan-${row.loan_id ?? row.entity_name}-${row.due_date}`}
              className="grid cursor-pointer grid-cols-[56px_30px_1fr_auto_64px_auto_64px] items-center gap-x-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
              onClick={() => onRowClick(row)}
            >
              {/* Date dd/Mmm */}
              <span className="text-sm text-zinc-600">
                {row.due_date ? formatCalendarDate(row.due_date) : '--'}
              </span>

              {/* Direction badge */}
              <DirectionBadge direction={row.direction} />

              {/* Entity name */}
              <span className="truncate text-sm text-zinc-800">
                {row.type === 'loan' ? `Loan: ${row.entity_name ?? '--'}` : row.entity_name ?? '--'}
              </span>

              {/* Invoice number */}
              <span className="font-mono text-xs text-zinc-400">
                {row.invoice_number ?? ''}
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
      )}
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
            <Section key={group.id} group={group} onRowClick={onRowClick} />
          ),
      )}
    </div>
  )
}
