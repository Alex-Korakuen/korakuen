'use client'

import { useState } from 'react'
import { FilterSelect } from '@/components/ui/filter-select'
import { FK } from '@/lib/filter-keys'

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
  const [open, setOpen] = useState(false)

  const activeFilterCount = [
    currentFilters.direction,
    currentFilters.paymentType,
    currentFilters.relatedTo,
    currentFilters.projectId,
    currentFilters.bankAccountId,
  ].filter(Boolean).length

  // Auto-open if filters are active on load
  const [autoOpened] = useState(() => hasActiveFilters)
  const isOpen = open || autoOpened

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center px-3 py-2">
        <button
          onClick={() => setOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
            isOpen
              ? 'border-blue-200 bg-blue-50 text-blue-600'
              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FilterSelect
              label="Direction"
              value={currentFilters.direction}
              onChange={(v) => setFilter(FK.direction, v)}
              options={[
                { value: 'inbound', label: 'Inbound' },
                { value: 'outbound', label: 'Outbound' },
              ]}
              placeholder="All"
            />

            <FilterSelect
              label="Type"
              value={currentFilters.paymentType}
              onChange={(v) => setFilter(FK.type, v)}
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
              onChange={(v) => setFilter(FK.related, v)}
              options={[
                { value: 'invoice', label: 'Invoice' },
                { value: 'loan_schedule', label: 'Loan' },
              ]}
              placeholder="All"
            />

            <FilterSelect
              label="Project"
              value={currentFilters.projectId}
              onChange={(v) => setFilter(FK.project, v)}
              options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
              placeholder="All projects"
            />

            <FilterSelect
              label="Bank Account"
              value={currentFilters.bankAccountId}
              onChange={(v) => setFilter(FK.bank, v)}
              options={bankAccounts.map((b) => ({ value: b.id, label: b.label }))}
              placeholder="All accounts"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="self-end rounded px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:text-red-500"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
