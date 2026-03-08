'use client'

import { useState, useTransition } from 'react'
import { SectionCard } from '@/components/ui/section-card'
import { addProjectPartner, removeProjectPartner } from '@/lib/actions'
import type { ProjectPartnerRow } from '@/lib/types'
import type { PartnerCompanyOption } from '@/lib/queries'
import { inputCompactClass } from '@/lib/styles'

type Props = {
  projectId: string
  partners: ProjectPartnerRow[]
  partnerCompanies: PartnerCompanyOption[]
}

export function ProjectPartnersForm({ projectId, partners, partnerCompanies }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [selectedPartner, setSelectedPartner] = useState('')
  const [profitShare, setProfitShare] = useState('')

  const totalShare = partners.reduce((sum, p) => sum + p.profitSharePct, 0)
  const assignedIds = new Set(partners.map(p => p.partnerCompanyId))
  const availablePartners = partnerCompanies.filter(p => !assignedIds.has(p.id))

  function handleAdd() {
    if (!selectedPartner || !profitShare) return
    const pct = parseFloat(profitShare)
    if (isNaN(pct) || pct <= 0 || pct > 100) return
    setError(null)

    startTransition(async () => {
      try {
        await addProjectPartner(projectId, selectedPartner, pct)
        setSelectedPartner('')
        setProfitShare('')
        setShowForm(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add partner')
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await removeProjectPartner(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove partner')
      }
    })
  }

  return (
    <SectionCard title="Partners">
      <div className="px-4 py-2">
        {partners.length === 0 && !showForm ? (
          <p className="py-4 text-center text-sm text-zinc-400">No partners assigned</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 text-left font-medium">Partner</th>
                <th className="py-1 text-right font-medium">Share %</th>
                <th className="py-1 text-right font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {partners.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 text-zinc-700">{p.partnerName}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-700">{p.profitSharePct}%</td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => handleRemove(p.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {partners.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200">
                  <td className="py-1.5 font-medium text-zinc-700">Total</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${
                    totalShare === 100 ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {totalShare}%
                  </td>
                  <td className="py-1.5 text-right">
                    {totalShare === 100 ? (
                      <span className="text-xs text-green-600">OK</span>
                    ) : (
                      <span className="text-xs text-amber-600">{totalShare < 100 ? `${100 - totalShare}% remaining` : 'Over 100%'}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {/* Add form */}
        {showForm ? (
          <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <select
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  className={`w-full ${inputCompactClass}`}
                >
                  <option value="">Select partner...</option>
                  {availablePartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  value={profitShare}
                  onChange={(e) => setProfitShare(e.target.value)}
                  placeholder="%"
                  min="0"
                  max="100"
                  step="0.01"
                  className={`w-full ${inputCompactClass} font-mono`}
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!selectedPartner || !profitShare || isPending}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null) }}
                className="rounded px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            disabled={availablePartners.length === 0}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-zinc-400"
          >
            + Add partner
          </button>
        )}
      </div>
    </SectionCard>
  )
}
