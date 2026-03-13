'use client'

import { FilterSelect } from '@/components/ui/filter-select'

type Props = {
  currentFilters: {
    direction: string
    type: string
    status: string
    projectId: string
    entity: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function InvoicesFilters({
  currentFilters,
  setFilter,
  projects,
  uniqueEntities,
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
          { value: 'payable', label: 'Payable (AP)' },
          { value: 'receivable', label: 'Receivable (AR)' },
        ]}
        placeholder="All"
      />

      <FilterSelect
        label="Type"
        value={currentFilters.type}
        onChange={(v) => setFilter('type', v)}
        options={[
          { value: 'commercial', label: 'Commercial' },
          { value: 'loan', label: 'Loan' },
        ]}
        placeholder="All"
      />

      <FilterSelect
        label="Status"
        value={currentFilters.status}
        onChange={(v) => setFilter('status', v)}
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'partial', label: 'Partial' },
          { value: 'paid', label: 'Paid' },
          { value: 'overdue', label: 'Overdue' },
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
        label="Entity"
        value={currentFilters.entity}
        onChange={(v) => setFilter('entity', v)}
        options={uniqueEntities.map((name) => ({ value: name, label: name }))}
        placeholder="All entities"
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
