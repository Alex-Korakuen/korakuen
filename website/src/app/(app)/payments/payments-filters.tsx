'use client'

import { FilterSelect } from '@/components/ui/filter-select'

type Props = {
  currentFilters: {
    direction: string
    paymentType: string
    relatedTo: string
    projectId: string
    bankAccountId: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string }[]
  bankAccounts: { id: string; label: string }[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function PaymentsFilters({
  currentFilters,
  setFilter,
  projects,
  bankAccounts,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterSelect
        label="Direction"
        value={currentFilters.direction}
        onChange={(v) => setFilter('direction', v)}
        options={[
          { value: 'inbound', label: 'Inbound' },
          { value: 'outbound', label: 'Outbound' },
        ]}
        placeholder="All"
      />

      <FilterSelect
        label="Type"
        value={currentFilters.paymentType}
        onChange={(v) => setFilter('type', v)}
        options={[
          { value: 'regular', label: 'Regular' },
          { value: 'detraccion', label: 'Detraccion' },
          { value: 'retencion', label: 'Retencion' },
        ]}
        placeholder="All"
      />

      <FilterSelect
        label="Related To"
        value={currentFilters.relatedTo}
        onChange={(v) => setFilter('related', v)}
        options={[
          { value: 'invoice', label: 'Invoice' },
          { value: 'loan_schedule', label: 'Loan' },
        ]}
        placeholder="All"
      />

      <FilterSelect
        label="Project"
        value={currentFilters.projectId}
        onChange={(v) => setFilter('project', v)}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
      />

      <FilterSelect
        label="Bank Account"
        value={currentFilters.bankAccountId}
        onChange={(v) => setFilter('bank', v)}
        options={bankAccounts.map((b) => ({ value: b.id, label: b.label }))}
        placeholder="All accounts"
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="self-end rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
