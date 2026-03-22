'use client'

import { FilterSelect } from '@/components/ui/filter-select'
import { FK } from '@/lib/filter-keys'

type Props = {
  currentFilters: {
    direction: string
    paymentType: string
    relatedTo: string
    projectId: string
    bankAccountId: string
    partnerId: string
    month: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string }[]
  bankAccounts: { id: string; label: string }[]
  partners: { id: string; label: string }[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

function chipClass(isActive: boolean, activeClass: string): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer border ${
    isActive ? activeClass : 'border-edge bg-white text-muted hover:bg-surface'
  }`
}

export function PaymentsFilters({
  currentFilters,
  setFilter,
  projects,
  bankAccounts,
  partners,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  function toggleChip(filterKey: string, currentValue: string, chipValue: string) {
    setFilter(filterKey, currentValue === chipValue ? '' : chipValue)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Month picker */}
      <input
        type="month"
        defaultValue={currentFilters.month}
        onChange={(e) => setFilter(FK.month, e.target.value)}
        className="rounded border border-edge bg-white px-2 py-1 text-xs text-muted"
      />

      <div className="h-5 w-px bg-edge" />

      {/* Direction chips */}
      <div className="flex gap-1">
        <button
          className={chipClass(currentFilters.direction === 'inbound', 'border-positive/20 bg-positive-bg text-positive')}
          onClick={() => toggleChip(FK.direction, currentFilters.direction, 'inbound')}
        >
          In
        </button>
        <button
          className={chipClass(currentFilters.direction === 'outbound', 'border-negative/20 bg-negative-bg text-negative')}
          onClick={() => toggleChip(FK.direction, currentFilters.direction, 'outbound')}
        >
          Out
        </button>
      </div>

      <div className="h-5 w-px bg-edge" />

      {/* Type chips */}
      <div className="flex gap-1">
        <button
          className={chipClass(currentFilters.paymentType === 'regular', 'border-edge-strong bg-edge text-ink')}
          onClick={() => toggleChip(FK.type, currentFilters.paymentType, 'regular')}
        >
          Regular
        </button>
        <button
          className={chipClass(currentFilters.paymentType === 'detraccion', 'border-accent/20 bg-accent-bg text-accent')}
          onClick={() => toggleChip(FK.type, currentFilters.paymentType, 'detraccion')}
        >
          Det
        </button>
        <button
          className={chipClass(currentFilters.paymentType === 'retencion', 'border-yellow-200 bg-yellow-100 text-yellow-700')}
          onClick={() => toggleChip(FK.type, currentFilters.paymentType, 'retencion')}
        >
          Ret
        </button>
      </div>

      <div className="h-5 w-px bg-edge" />

      {/* Related-to chips */}
      <div className="flex gap-1">
        <button
          className={chipClass(currentFilters.relatedTo === 'invoice', 'border-indigo-200 bg-indigo-100 text-indigo-700')}
          onClick={() => toggleChip(FK.related, currentFilters.relatedTo, 'invoice')}
        >
          Invoice
        </button>
        <button
          className={chipClass(currentFilters.relatedTo === 'loan_schedule', 'border-indigo-200 bg-indigo-100 text-indigo-700')}
          onClick={() => toggleChip(FK.related, currentFilters.relatedTo, 'loan_schedule')}
        >
          Loan
        </button>
      </div>

      <div className="h-5 w-px bg-edge" />

      {/* Project dropdown */}
      <FilterSelect
        value={currentFilters.projectId}
        onChange={(v) => setFilter(FK.project, v)}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
      />

      {/* Bank dropdown */}
      <FilterSelect
        value={currentFilters.bankAccountId}
        onChange={(v) => setFilter(FK.bank, v)}
        options={bankAccounts.map((b) => ({ value: b.id, label: b.label }))}
        placeholder="All banks"
      />

      {/* Partner dropdown */}
      <FilterSelect
        value={currentFilters.partnerId}
        onChange={(v) => setFilter(FK.partner, v)}
        options={partners.map((p) => ({ value: p.id, label: p.label }))}
        placeholder="All partners"
      />

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded px-2 py-1 text-xs text-faint transition-colors hover:text-negative"
        >
          Clear
        </button>
      )}
    </div>
  )
}
