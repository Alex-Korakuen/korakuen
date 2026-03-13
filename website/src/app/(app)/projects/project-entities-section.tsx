import { formatCurrency } from '@/lib/formatters'
import type { ProjectDetailData } from '@/lib/types'

export function ProjectEntitiesSection({ entities }: { entities: ProjectDetailData['entities'] }) {
  return (
    <>
      {entities.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-400">
          No costs recorded
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Entity Name</th>
                <th className="px-4 py-2 text-left font-medium">Tags</th>
                <th className="px-4 py-2 text-right font-medium">Total Spent</th>
                <th className="px-4 py-2 text-right font-medium"># Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entities.map((e, i) => (
                <tr key={`${e.entityId ?? 'none'}-${e.currency}-${i}`} className="transition-colors hover:bg-blue-50">
                  <td className="px-4 py-2">
                    {e.entityId ? (
                      <a
                        href={`/entities?selected=${e.entityId}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {e.entityName}
                      </a>
                    ) : (
                      <span className="font-medium text-zinc-800">{e.entityName}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {e.tags.length > 0 ? e.tags.join(', ') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                    {e.totalSpent !== null ? formatCurrency(e.totalSpent, e.currency) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {e.invoiceCount ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(() => {
                const byCurrency: Record<string, { total: number; count: number }> = {}
                for (const e of entities) {
                  if (e.totalSpent === null) continue
                  const c = e.currency
                  if (!byCurrency[c]) byCurrency[c] = { total: 0, count: 0 }
                  byCurrency[c].total += e.totalSpent
                  byCurrency[c].count += e.invoiceCount ?? 0
                }
                const currencies = Object.keys(byCurrency).sort()
                if (currencies.length === 0) return null
                return currencies.map((c, i) => (
                  <tr key={c} className={`${i === 0 ? 'border-t border-zinc-200' : ''} bg-zinc-50`}>
                    <td className="px-4 py-2 text-sm font-medium text-zinc-700">
                      {currencies.length > 1 ? `Total ${c}` : 'Total'}
                    </td>
                    <td className="px-4 py-2" />
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                      {formatCurrency(byCurrency[c].total, c)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-zinc-700">
                      {byCurrency[c].count}
                    </td>
                  </tr>
                ))
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
