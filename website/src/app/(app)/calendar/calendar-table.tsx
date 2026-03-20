'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { formatCalendarDate, formatUrgency, getUrgencyColor, getSectionColors } from './helpers'
import type { SectionTotals } from './calendar-client'
import type { ObligationCalendarRow, CalendarBucketId } from '@/lib/types'
import { badgeAP, badgeAR } from '@/lib/styles'

type BucketGroup = {
  id: Exclude<CalendarBucketId, 'all'>
  label: string
  rows: ObligationCalendarRow[]
  totals: SectionTotals
}

type Props = {
  groups: BucketGroup[]
  grandTotals: SectionTotals
  onRowClick: (row: ObligationCalendarRow) => void
}

function DirectionBadge({ direction }: { direction: string | null }) {
  const colors = direction === 'receivable' ? badgeAR : badgeAP
  const label = direction === 'receivable' ? 'AR' : 'AP'
  return (
    <span className={`inline-flex w-7 items-center justify-center rounded px-1 py-0.5 text-[11px] font-medium uppercase tracking-wider ${colors}`}>
      {label}
    </span>
  )
}

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

/** Buckets that should be expanded by default (operational horizon) */
const EXPANDED_BY_DEFAULT = new Set(['overdue', 'today', 'next-7'])

function Section({ group, onRowClick }: { group: BucketGroup; onRowClick: (row: ObligationCalendarRow) => void }) {
  const [open, setOpen] = useState(EXPANDED_BY_DEFAULT.has(group.id))
  const colors = getSectionColors(group.id)
  const totalCount = group.totals.pay.count + group.totals.collect.count

  return (
    <div className={`mt-4 first:mt-0 overflow-hidden rounded-lg border border-zinc-200 bg-white border-t-[3px] ${colors.border}`}>
      {/* Header zone — clickable */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`flex w-full cursor-pointer flex-col px-4 py-3 text-left transition-colors ${open ? `${colors.bg} border-b border-zinc-100` : 'hover:bg-zinc-50'}`}
      >
        {/* Top row: label + item count + chevron */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
            {group.label}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-400">
              {totalCount} {totalCount === 1 ? 'item' : 'items'}
            </span>
            <svg
              className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? '' : '-rotate-90'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Bottom row: Pay + Collect totals — min-width keeps Collect aligned across sections */}
        <div className="mt-1.5 flex items-center gap-x-6">
          {group.totals.pay.count > 0 && (
            <span className="flex min-w-[300px] items-center gap-1.5 text-xs text-zinc-600">
              <span className="font-medium text-orange-600">Pay</span>
              <DualAmount pen={group.totals.pay.pen} usd={group.totals.pay.usd} />
            </span>
          )}
          {group.totals.collect.count > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className="font-medium text-emerald-600">Collect</span>
              <DualAmount pen={group.totals.collect.pen} usd={group.totals.collect.usd} />
            </span>
          )}
        </div>
      </button>

      {/* Data rows */}
      {open && (
        <div className="divide-y divide-zinc-100">
          {group.rows.map((row) => (
            <div
              key={row.invoice_id ?? `loan-${row.loan_id ?? row.entity_name}-${row.due_date}`}
              className="grid cursor-pointer grid-cols-[60px_30px_100px_1fr_60px_120px_56px] items-center gap-x-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
              onClick={() => onRowClick(row)}
            >
              <span className="text-sm text-zinc-600">
                {row.due_date ? formatCalendarDate(row.due_date) : '--'}
              </span>
              <DirectionBadge direction={row.direction} />
              <span className="truncate font-mono text-xs text-zinc-400">
                {row.invoice_number ?? ''}
              </span>
              <span className="truncate text-sm text-zinc-800">
                {row.type === 'loan' ? `Loan: ${row.entity_name ?? '--'}` : row.entity_name ?? '--'}
              </span>
              <span className="font-mono text-xs text-zinc-500">
                {row.project_code ?? '--'}
              </span>
              <span className="text-right font-mono text-sm font-medium text-zinc-900">
                {row.outstanding !== null && row.currency
                  ? formatCurrency(row.outstanding, row.currency)
                  : '--'}
              </span>
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

function TotalBar({ totals }: { totals: SectionTotals }) {
  const totalCount = totals.pay.count + totals.collect.count
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-300 bg-zinc-50/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
        <span className="text-xs font-medium text-zinc-500">
          {totalCount} {totalCount === 1 ? 'obligation' : 'obligations'}
        </span>
        <div className="flex items-center gap-6">
          {totals.pay.count > 0 && (
            <span className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-orange-600">Total Pay</span>
              <DualAmount pen={totals.pay.pen} usd={totals.pay.usd} />
            </span>
          )}
          {totals.collect.count > 0 && (
            <span className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-emerald-600">Total Collect</span>
              <DualAmount pen={totals.collect.pen} usd={totals.collect.usd} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function CalendarTable({ groups, grandTotals, onRowClick }: Props) {
  const hasAnyRows = groups.some(g => g.rows.length > 0)

  if (!hasAnyRows) {
    return (
      <div className="mt-6 rounded-lg border border-zinc-200 px-4 py-8 text-center text-zinc-400">
        No obligations found
      </div>
    )
  }

  return (
    <>
      <div className="mt-4">
        {groups.map(
          (group) =>
            group.rows.length > 0 && (
              <Section key={group.id} group={group} onRowClick={onRowClick} />
            ),
        )}
      </div>
      <TotalBar totals={grandTotals} />
    </>
  )
}
