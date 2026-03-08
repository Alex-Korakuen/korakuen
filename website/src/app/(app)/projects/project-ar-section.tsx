import { formatCurrency, formatDate } from '@/lib/formatters'
import { SectionCard } from '@/components/ui/section-card'
import type { ProjectDetailData, Currency } from '@/lib/types'

export function ProjectArSection({ arInvoices }: { arInvoices: ProjectDetailData['arInvoices'] }) {
  return (
    <SectionCard title="AR Invoices">
      {arInvoices.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-400">
          No AR invoices
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Invoice #</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Gross Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {arInvoices.map((ar) => (
                <tr key={ar.id} className="transition-colors hover:bg-blue-50">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-800">
                    {ar.invoice_number ?? '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                    {ar.invoice_date ? formatDate(ar.invoice_date) : '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                    {formatCurrency(ar.gross_total, ar.currency as Currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}
