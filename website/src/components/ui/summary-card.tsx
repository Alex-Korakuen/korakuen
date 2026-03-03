'use client'

import { formatCurrency } from '@/lib/formatters'

type SummaryCardProps = {
  title: string
  count: number
  totalPEN: number
  totalUSD: number
  variant?: 'overdue' | 'today' | 'this-week' | 'future' | 'default'
  isActive: boolean
  onClick: () => void
}

const variantBorderColors: Record<string, string> = {
  overdue: 'border-l-[var(--color-overdue)]',
  today: 'border-l-[var(--color-today)]',
  'this-week': 'border-l-[var(--color-this-week)]',
  future: 'border-l-[var(--color-neutral)]',
  default: 'border-l-[var(--color-neutral)]',
}

export function SummaryCard({
  title,
  count,
  totalPEN,
  totalUSD,
  variant = 'default',
  isActive,
  onClick,
}: SummaryCardProps) {
  const borderColor = variantBorderColors[variant] ?? variantBorderColors.default

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex min-w-[160px] flex-1 flex-col gap-1 rounded-lg border border-zinc-200 border-l-4 bg-white
        px-5 py-4 text-left transition-shadow
        hover:shadow-md
        ${borderColor}
        ${isActive ? 'ring-2 ring-zinc-400' : ''}
      `}
    >
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {title}
      </span>
      <span className="text-lg font-semibold text-zinc-900">
        {formatCurrency(totalPEN, 'PEN')}
      </span>
      {totalUSD !== 0 && (
        <span className="text-sm text-zinc-600">
          {formatCurrency(totalUSD, 'USD')}
        </span>
      )}
      <span className="text-xs text-zinc-400">
        {count} {count === 1 ? 'item' : 'items'}
      </span>
    </button>
  )
}
