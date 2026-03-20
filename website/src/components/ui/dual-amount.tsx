import { formatCurrency } from '@/lib/formatters'

/** Displays PEN and/or USD amounts side-by-side, separated by a pipe. */
export function DualAmount({ pen, usd }: { pen: number; usd: number }) {
  if (pen === 0 && usd === 0) return <span className="text-zinc-400">--</span>
  return (
    <span className="font-mono text-xs">
      {pen !== 0 && formatCurrency(Math.abs(pen), 'PEN')}
      {pen !== 0 && usd !== 0 && <span className="mx-1 text-zinc-300">|</span>}
      {usd !== 0 && formatCurrency(Math.abs(usd), 'USD')}
    </span>
  )
}
