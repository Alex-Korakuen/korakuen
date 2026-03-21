'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { registerDirectTransaction } from '@/lib/actions'
import { inputClass, btnPrimaryLg } from '@/lib/styles'
import type { PartnerCompanyOption, CategoryOption } from '@/lib/types'

type Props = {
  isOpen: boolean
  onClose: () => void
  partners: PartnerCompanyOption[]
  projects: { id: string; project_code: string; name: string }[]
  categories: CategoryOption[]
}

export function DirectTransactionModal({ isOpen, onClose, partners, projects, categories }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [partnerId, setPartnerId] = useState('')
  const [direction, setDirection] = useState<'outflow' | 'inflow'>('outflow')
  const [projectId, setProjectId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')

  const projectCostCategories = categories.filter(c => c.cost_type === 'project_cost')

  function resetForm() {
    setPartnerId('')
    setDirection('outflow')
    setProjectId('')
    setAmount('')
    setCurrency('PEN')
    setExchangeRate('1')
    setDate(new Date().toISOString().slice(0, 10))
    setCategory('')
    setNotes('')
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleSubmit() {
    setError(null)
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Amount must be greater than 0')
      return
    }
    const parsedRate = parseFloat(exchangeRate)
    if (!parsedRate || parsedRate <= 0) {
      setError('Exchange rate must be greater than 0')
      return
    }

    startTransition(async () => {
      const result = await registerDirectTransaction({
        partner_company_id: partnerId,
        direction,
        project_id: projectId,
        amount: parsedAmount,
        currency,
        exchange_rate: parsedRate,
        date,
        category: direction === 'outflow' ? (category || null) : null,
        notes: notes.trim() || null,
      })

      if (result.error) {
        setError(result.error)
      } else {
        handleClose()
        router.refresh()
      }
    })
  }

  const canSubmit = partnerId && projectId && amount && date && !isPending

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Register Direct Transaction">
      <div className="space-y-4 p-4">
        {/* Direction toggle */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Direction</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection('outflow')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                direction === 'outflow'
                  ? 'border-caution bg-caution-bg text-caution'
                  : 'border-edge text-muted hover:border-edge-strong'
              }`}
            >
              Outflow (cost)
            </button>
            <button
              type="button"
              onClick={() => setDirection('inflow')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                direction === 'inflow'
                  ? 'border-positive bg-positive-bg text-positive'
                  : 'border-edge text-muted hover:border-edge-strong'
              }`}
            >
              Inflow (revenue)
            </button>
          </div>
        </div>

        {/* Partner */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Partner</label>
          <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className={inputClass}>
            <option value="">Select partner...</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Project */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClass}>
            <option value="">Select project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_code} — {p.name}</option>
            ))}
          </select>
        </div>

        {/* Amount + Currency row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`${inputClass} font-mono text-right`}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value as 'PEN' | 'USD')} className={inputClass}>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Exchange rate (always shown, required) */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Exchange Rate</label>
          <input
            type="number"
            value={exchangeRate}
            onChange={e => setExchangeRate(e.target.value)}
            min="0"
            step="0.0001"
            className={`${inputClass} font-mono text-right`}
          />
        </div>

        {/* Date */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Category (outflow only) */}
        {direction === 'outflow' && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
              <option value="">Select category...</option>
              {projectCostCategories.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Description of the transaction"
            className={inputClass}
          />
        </div>

        {error && <p className="text-xs font-medium text-negative">{error}</p>}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-edge pt-4">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="rounded-md border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`${btnPrimaryLg} disabled:opacity-50`}
          >
            {isPending ? 'Saving...' : 'Register'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
