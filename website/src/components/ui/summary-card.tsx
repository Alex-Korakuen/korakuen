'use client'

import { formatCurrency } from '@/lib/formatters'
import type { BucketValue } from '@/lib/types'

type SummaryCardProps = {
  title: string
  pay: BucketValue
  collect: BucketValue
  variant?: 'overdue' | 'today' | 'this-week' | 'future' | 'default'
  activeSide: 'pay' | 'collect' | null
  onClickPay: () => void
  onClickCollect: () => void
}

const variantBorderColors: Record<string, string> = {
  overdue: 'border-l-[var(--color-overdue)]',
  today: 'border-l-[var(--color-today)]',
  'this-week': 'border-l-[var(--color-this-week)]',
  future: 'border-l-[var(--color-neutral)]',
  default: 'border-l-[var(--color-neutral)]',
}

function BucketRow({
  label,
  bucket,
  isActive,
  onClick,
}: {
  label: string
  bucket: BucketValue
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-zinc-100 ${
        isActive ? 'bg-zinc-100 ring-1 ring-zinc-300' : ''
      }`}
    >
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-right">
        <span className="text-sm font-semibold text-zinc-900">
          {formatCurrency(bucket.pen, 'PEN')}
        </span>
        {bucket.usd !== 0 && (
          <span className="ml-1 text-xs text-zinc-500">
            {formatCurrency(bucket.usd, 'USD')}
          </span>
        )}
        <span className="ml-1 text-xs text-zinc-400">
          ({bucket.count})
        </span>
      </span>
    </button>
  )
}

export function SummaryCard({
  title,
  pay,
  collect,
  variant = 'default',
  activeSide,
  onClickPay,
  onClickCollect,
}: SummaryCardProps) {
  const borderColor = variantBorderColors[variant] ?? variantBorderColors.default

  return (
    <div
      className={`
        flex min-w-[200px] flex-1 flex-col gap-1.5 rounded-lg border border-zinc-200 border-l-4 bg-white
        px-4 py-3 text-left
        ${borderColor}
      `}
    >
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {title}
      </span>
      <BucketRow label="Pay" bucket={pay} isActive={activeSide === 'pay'} onClick={onClickPay} />
      <BucketRow label="Collect" bucket={collect} isActive={activeSide === 'collect'} onClick={onClickCollect} />
    </div>
  )
}
