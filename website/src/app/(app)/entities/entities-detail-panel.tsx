'use client'

import { formatCurrency, formatDate, formatEntityType } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { TabBar } from '@/components/ui/tab-bar'
import { EntityTagsDropdown } from './entity-tags-dropdown'
import { EntityContactsForm } from './entity-contacts-form'
import type { Tab } from '@/components/ui/tab-bar'
import type { EntityDetailData, EntityLedgerGroup } from '@/lib/types'

type Props = {
  detail: EntityDetailData
  availableTags: { id: string; name: string }[]
  onLedgerClick: (group: EntityLedgerGroup) => void
  hidden: boolean
}

function LedgerTable({ groups, onRowClick, emptyMessage }: {
  groups: EntityLedgerGroup[]
  onRowClick: (group: EntityLedgerGroup) => void
  emptyMessage: string
}) {
  if (groups.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-zinc-500">{emptyMessage}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Project</th>
            <th className="px-4 py-2 text-right font-medium">Invoice Total</th>
            <th className="px-4 py-2 text-right font-medium">Outstanding</th>
            <th className="px-4 py-2 text-right font-medium">Last Date</th>
            <th className="px-4 py-2 text-right font-medium">Currency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {groups.map((group) => (
            <tr
              key={`${group.projectId}|${group.currency}`}
              onClick={() => onRowClick(group)}
              className="cursor-pointer transition-colors hover:bg-blue-50"
            >
              <td className="px-4 py-2">
                <a
                  href={`/projects?selected=${group.projectId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {group.projectCode}
                </a>
                <span className="ml-1.5 hidden text-zinc-500 lg:inline">— {group.projectName}</span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-zinc-700">
                {formatCurrency(group.invoiceTotal, group.currency)}
              </td>
              <td className={`px-4 py-2 text-right font-mono font-medium ${
                group.outstanding > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {group.outstanding === 0 ? 'Paid' : formatCurrency(group.outstanding, group.currency)}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600">
                {group.lastDate ? formatDate(group.lastDate) : '—'}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600">{group.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EntitiesDetailPanel({ detail, availableTags, onLedgerClick, hidden }: Props) {
  const tabs: Tab[] = [
    {
      key: 'contacts',
      label: 'Contacts',
      content: <EntityContactsForm entityId={detail.entity.id} contacts={detail.contacts} />,
    },
    {
      key: 'payables',
      label: 'Payables',
      content: (
        <LedgerTable
          groups={detail.payablesByProject}
          onRowClick={onLedgerClick}
          emptyMessage="No payables recorded"
        />
      ),
    },
    {
      key: 'receivables',
      label: 'Receivables',
      content: (
        <LedgerTable
          groups={detail.receivablesByProject}
          onRowClick={onLedgerClick}
          emptyMessage="No receivables recorded"
        />
      ),
    },
  ]

  return (
    <div className={`min-w-0 flex-1 ${hidden ? 'hidden md:block' : ''}`}>
      <div className="space-y-4">
        {/* Entity Header */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-zinc-800">
                {detail.entity.legal_name}
              </h2>
              {detail.entity.common_name &&
                detail.entity.common_name !== detail.entity.legal_name && (
                  <p className="mt-0.5 text-sm text-zinc-500">{detail.entity.common_name}</p>
                )}
            </div>
          </div>

          {/* Type, document, location — single line */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <StatusBadge label={formatEntityType(detail.entity.entity_type)} variant="zinc" />
            {detail.entity.document_number && (
              <span>
                {detail.entity.document_type}: {detail.entity.document_number}
              </span>
            )}
            {(detail.entity.city || detail.entity.region) && (
              <span>
                {[detail.entity.city, detail.entity.region].filter(Boolean).join(', ')}
              </span>
            )}
          </div>

          {/* Tags */}
          <EntityTagsDropdown
            entityId={detail.entity.id}
            currentTags={detail.tags}
            availableTags={availableTags}
          />
        </div>

        {/* Tabbed sections */}
        <div className="rounded-lg border border-zinc-200 bg-white">
          <TabBar tabs={tabs} defaultTab="contacts" />
        </div>
      </div>
    </div>
  )
}
