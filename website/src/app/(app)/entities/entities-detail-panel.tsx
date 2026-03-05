import { formatCurrency, formatDate, formatEntityType } from '@/lib/formatters'
import { tagColor } from './helpers'
import { StatusBadge } from '@/components/ui/status-badge'
import { SectionCard } from '@/components/ui/section-card'
import type { EntityDetailData, Currency, ProjectTransactionGroup } from '@/lib/types'

type Props = {
  detail: EntityDetailData
  onTransactionClick: (group: ProjectTransactionGroup) => void
  hidden: boolean
}

export function EntitiesDetailPanel({ detail, onTransactionClick, hidden }: Props) {
  return (
    <div className={`min-w-0 flex-1 ${hidden ? 'hidden md:block' : ''}`}>
      <div className="space-y-6">
        {/* Entity Header */}
        <div>
          <h2 className="text-xl font-semibold text-zinc-800">
            {detail.entity.legal_name}
          </h2>
          {detail.entity.common_name &&
            detail.entity.common_name !== detail.entity.legal_name && (
              <p className="mt-0.5 text-sm text-zinc-500">{detail.entity.common_name}</p>
            )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Entity type badge */}
            <StatusBadge label={formatEntityType(detail.entity.entity_type)} variant="zinc" />

            {/* Document */}
            {detail.entity.document_number && (
              <span className="text-xs text-zinc-500">
                {detail.entity.document_type}: {detail.entity.document_number}
              </span>
            )}
          </div>

          {/* Tags */}
          {detail.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Location */}
          {(detail.entity.city || detail.entity.region) && (
            <p className="mt-2 text-xs text-zinc-500">
              {[detail.entity.city, detail.entity.region].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Contacts */}
        <SectionCard title="Contacts">
          {detail.contacts.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No contacts</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">Role</th>
                    <th className="px-4 py-2 text-left font-medium">Phone</th>
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-center font-medium">Primary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {detail.contacts.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-blue-50">
                      <td className="px-4 py-2 text-zinc-800">{c.full_name}</td>
                      <td className="px-4 py-2 text-zinc-600">{c.role ?? '—'}</td>
                      <td className="px-4 py-2 text-zinc-600">{c.phone ?? '—'}</td>
                      <td className="px-4 py-2 text-zinc-600">{c.email ?? '—'}</td>
                      <td className="px-4 py-2 text-center">
                        {c.is_primary && (
                          <svg
                            className="mx-auto h-4 w-4 text-amber-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                    const cur = group.currency as Currency
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
