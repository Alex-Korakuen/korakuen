import { formatCurrency } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import type { CostDetractionEntry } from '@/lib/types'

type Props = {
  detractions: CostDetractionEntry[]
}

export function ApCalendarTaxes({ detractions }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-800">Detracciones</h2>
      <p className="mt-1 text-sm text-zinc-500">
        SPOT detraccion obligations — amounts to be deposited to supplier Banco de la Nacion accounts.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Invoice Title</th>
              <th className="px-4 py-3 text-right">Detraccion Amt</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {detractions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  No detraccion obligations found
                </td>
              </tr>
            ) : (
              detractions.map((d) => (
                <tr key={d.cost_id}>
                  <td className="px-4 py-3 text-zinc-700">{d.entity_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                    {d.project_code}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{d.title ?? '--'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                    {formatCurrency(d.detraccion_amount, d.currency as 'PEN' | 'USD')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge
                      label={d.status === 'deposited' ? 'Deposited' : 'Pending'}
                      variant={d.status === 'deposited' ? 'green' : 'yellow'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Detracciones must be deposited to the supplier&apos;s Banco de la Nacion account
        within the timeframe established by SUNAT.
      </p>
    </div>
  )
}
