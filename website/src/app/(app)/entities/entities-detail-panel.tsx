import { formatCurrency, formatDate, formatEntityType } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { SectionCard } from '@/components/ui/section-card'
import { EntityTagsDropdown } from './entity-tags-dropdown'
import { EntityContactsForm } from './entity-contacts-form'
import type { EntityDetailData, ProjectTransactionGroup } from '@/lib/types'

type Props = {
  detail: EntityDetailData
  availableTags: { id: string; name: string }[]
  onTransactionClick: (group: ProjectTransactionGroup) => void
  hidden: boolean
}

export function EntitiesDetailPanel({ detail, availableTags, onTransactionClick, hidden }: Props) {
  return (
    <div className={`min-w-0 flex-1 ${hidden ? 'hidden md:block' : ''}`}>
      <div className="space-y-6">
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

        {/* Contacts */}
        <SectionCard title="Contacts">
          <EntityContactsForm entityId={detail.entity.id} contacts={detail.contacts} />
        </SectionCard>

        {/* Transaction History */}
        <SectionCard title="Transaction History">
          {detail.transactionsByProject.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              No transactions recorded
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Project</th>
                    <th className="px-4 py-2 text-right font-medium">AP Total</th>
                    <th className="px-4 py-2 text-right font-medium">AR Total</th>
                    <th className="px-4 py-2 text-right font-medium">Net</th>
                    <th className="px-4 py-2 text-right font-medium">Last Date</th>
                    <th className="px-4 py-2 text-right font-medium">Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {detail.transactionsByProject.map((group) => {
                    const cur = group.currency
                    return (
                      <tr
                        key={`${group.projectId}|${group.currency}`}
                        onClick={() => onTransactionClick(group)}
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
                          {group.apTotal > 0 ? formatCurrency(group.apTotal, cur) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-700">
                          {group.arTotal > 0 ? formatCurrency(group.arTotal, cur) : '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono font-medium ${
                            group.net > 0 ? 'text-green-600' : group.net < 0 ? 'text-red-600' : 'text-zinc-600'
                          }`}
                        >
                          {formatCurrency(group.net, cur)}
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-600">
                          {group.lastDate ? formatDate(group.lastDate) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-600">{group.currency}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
