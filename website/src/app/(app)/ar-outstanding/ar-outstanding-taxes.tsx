'use client'

import { useState, useMemo } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getRetencionAgingColor } from './helpers'
import type { RetencionDashboardRow, ArDetractionEntry } from '@/lib/types'

type Props = {
  retenciones: RetencionDashboardRow[]
  detracciones: ArDetractionEntry[]
  projects: { id: string; project_code: string; name: string }[]
  uniqueClients: string[]
}

export function ArOutstandingTaxes({ retenciones, detracciones, projects, uniqueClients }: Props) {
  const [retFilter, setRetFilter] = useState({ projectCode: '', client: '', status: '' })

  const filteredRetenciones = useMemo(() => {
    let rows = retenciones
    if (retFilter.projectCode) {
      rows = rows.filter((r) => r.project_code === retFilter.projectCode)
    }
    if (retFilter.client) {
      rows = rows.filter((r) => r.client_name === retFilter.client)
    }
    if (retFilter.status) {
      const verified = retFilter.status === 'verified'
      rows = rows.filter((r) => r.retencion_verified === verified)
    }
    return rows
  }, [retenciones, retFilter])

  return (
    <div className="space-y-8">
      {/* Retenciones section */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-800">Retenciones</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Has the client paid the 3% retencion to SUNAT?
        </p>

        {/* Retencion filters */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Project</label>
            <select
              value={retFilter.projectCode}
              onChange={(e) => setRetFilter((f) => ({ ...f, projectCode: e.target.value }))}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.project_code}>
                  {p.project_code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Client</label>
            <select
              value={retFilter.client}
              onChange={(e) => setRetFilter((f) => ({ ...f, client: e.target.value }))}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              <option value="">All clients</option>
              {uniqueClients.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Status</label>
            <select
              value={retFilter.status}
              onChange={(e) => setRetFilter((f) => ({ ...f, status: e.target.value }))}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              <option value="">All</option>
              <option value="unverified">Unverified</option>
              <option value="verified">Verified</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Invoice#</th>
                <th className="px-4 py-3">Inv. Date</th>
                <th className="px-4 py-3 text-right">Days</th>
                <th className="px-4 py-3 text-right">Ret. Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRetenciones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    No retenciones found
                  </td>
                </tr>
              ) : (
                filteredRetenciones.map((r) => (
                  <tr key={r.ar_invoice_id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                      {r.project_code}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{r.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-700">
                      {r.invoice_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                      {r.invoice_date ? formatDate(r.invoice_date) : '--'}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right ${getRetencionAgingColor(r.days_since_invoice ?? 0, r.retencion_verified ?? false)}`}>
                      {r.days_since_invoice ?? '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                      {formatCurrency(r.retencion_amount ?? 0, (r.currency ?? 'PEN') as 'PEN' | 'USD')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.retencion_verified
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {r.retencion_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detracciones section */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-800">Detracciones</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Has the client deposited to our Banco de la Nacion?
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Invoice#</th>
                <th className="px-4 py-3 text-right">Detr. Amount</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {detracciones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    No detracciones found
                  </td>
                </tr>
              ) : (
                detracciones.map((d) => (
                  <tr key={d.ar_invoice_id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                      {d.project_code}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{d.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-700">
                      {d.invoice_number ?? '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                      {formatCurrency(d.detraccion_amount, d.currency as 'PEN' | 'USD')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-green-700">
                      {formatCurrency(d.received, d.currency as 'PEN' | 'USD')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                      <span className={d.pending > 0 ? 'text-red-600 font-medium' : 'text-zinc-400'}>
                        {d.pending > 0
                          ? formatCurrency(d.pending, d.currency as 'PEN' | 'USD')
                          : '--'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
