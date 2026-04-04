'use client'

import { TrashIcon } from './trash-icon'
import { formatPercentage } from '@/lib/formatters'
import type { PartnerOption } from '@/lib/types'

export type PartnerEntry = { partnerId: string; profitSharePct: string }

type Size = 'sm' | 'md'

type Props = {
  value: PartnerEntry[]
  onChange: (next: PartnerEntry[]) => void
  partnerOptions: PartnerOption[]
  /** 'sm' = inline inside detail views; 'md' = form inputs inside modals */
  size?: Size
  /** Show the "Total: X%" / "(must be 100%)" helper line below the rows */
  showTotal?: boolean
}

/** Controlled editor for a project's partner profit-share allocation.
 *  Validation (total === 100%) is the caller's responsibility via isPartnerAllocationValid(). */
export function PartnerAllocationEditor({
  value,
  onChange,
  partnerOptions,
  size = 'md',
  showTotal = true,
}: Props) {
  const total = value.reduce((s, e) => s + (parseFloat(e.profitSharePct) || 0), 0)
  const available = partnerOptions.filter(po => !value.some(e => e.partnerId === po.id))

  const addPartner = () => {
    if (available.length === 0) return
    onChange([...value, { partnerId: available[0].id, profitSharePct: '' }])
  }
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const updateAt = (i: number, field: keyof PartnerEntry, v: string) =>
    onChange(value.map((e, idx) => (idx === i ? { ...e, [field]: v } : e)))

  const selectCls = size === 'sm'
    ? 'rounded border border-edge bg-white px-2 py-1 text-xs text-ink flex-1'
    : 'w-full rounded border border-edge px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent flex-1'
  const inputCls = size === 'sm'
    ? 'w-16 rounded border border-edge bg-white px-1.5 py-1 text-center text-xs font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
    : 'w-20 rounded border border-edge px-3 py-2 text-sm text-right font-mono text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
  const percentCls = size === 'sm' ? 'text-[10px] text-muted' : 'text-sm text-muted'
  const iconSize = size === 'sm' ? 'sm' : 'md'

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={e.partnerId}
                onChange={ev => updateAt(i, 'partnerId', ev.target.value)}
                className={selectCls}
              >
                {partnerOptions
                  .filter(po => po.id === e.partnerId || !value.some(ee => ee.partnerId === po.id))
                  .map(po => (
                    <option key={po.id} value={po.id}>{po.name}</option>
                  ))}
              </select>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={e.profitSharePct}
                onChange={ev => updateAt(i, 'profitSharePct', ev.target.value)}
                className={inputCls}
              />
              <span className={percentCls}>%</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="rounded p-1 text-negative/60 transition-colors hover:bg-negative-bg hover:text-negative"
                title="Remove partner"
              >
                <TrashIcon size={iconSize} />
              </button>
            </div>
          ))}
        </div>
      )}
      {showTotal && value.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-medium ${Math.abs(total - 100) < 0.01 ? 'text-positive' : 'text-negative'}`}>
            Total: {formatPercentage(total)}
          </span>
          {Math.abs(total - 100) >= 0.01 && <span className="text-faint">(must be 100%)</span>}
        </div>
      )}
      {available.length > 0 && (
        <button
          type="button"
          onClick={addPartner}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          + Add partner
        </button>
      )}
    </div>
  )
}

/** Empty is valid; otherwise must sum to 100%. */
export function isPartnerAllocationValid(entries: PartnerEntry[]): boolean {
  if (entries.length === 0) return true
  const total = entries.reduce((s, e) => s + (parseFloat(e.profitSharePct) || 0), 0)
  return Math.abs(total - 100) < 0.01
}
