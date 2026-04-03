'use client'

import { useState, useEffect, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { ModalActions } from '@/components/ui/modal-actions'
import { EntityPicker } from '@/components/ui/entity-picker'
import { createLoan, fetchBankAccountsForPayment } from '@/lib/actions'
import type { BankAccountOption } from '@/lib/actions'
import type { PartnerOption, Currency } from '@/lib/types'
import { inputClass } from '@/lib/styles'
import { todayISO } from '@/lib/date-utils'
import { useExchangeRate } from '@/lib/use-exchange-rate'

type Props = {
  isOpen: boolean
  onClose: () => void
  partners: PartnerOption[]
  projects: { id: string; project_code: string; name: string }[]
}

export function CreateLoanModal({ isOpen, onClose, partners, projects }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [partnerId, setPartnerId] = useState('')
  const [entityId, setEntityId] = useState<string | null>(null)
  const [entityName, setEntityName] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('PEN')
  const [dateBorrowed, setDateBorrowed] = useState(todayISO)
  const [projectId, setProjectId] = useState('')
  const [returnType, setReturnType] = useState<'percentage' | 'fixed'>('percentage')
  const [agreedReturnRate, setAgreedReturnRate] = useState('10')
  const [agreedReturnAmount, setAgreedReturnAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [operationNumber, setOperationNumber] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])

  // Auto-fetch exchange rate when date changes
  const exchangeRate = useExchangeRate(dateBorrowed, isOpen)

  // Auto-fetch bank accounts when partner changes
  useEffect(() => {
    if (!isOpen || !partnerId) { setBankAccounts([]); setBankAccountId(''); return }
    fetchBankAccountsForPayment(partnerId)
      .then(accts => setBankAccounts(accts))
      .catch((err) => { console.error('Failed to load bank accounts:', err); setBankAccounts([]) })
  }, [partnerId, isOpen])

  function resetForm() {
    setPartnerId('')
    setEntityId(null)
    setEntityName(null)
    setAmount('')
    setCurrency('PEN')
    setDateBorrowed(todayISO())
    setProjectId('')
    setReturnType('percentage')
    setAgreedReturnRate('10')
    setAgreedReturnAmount('')
    setDueDate('')
    setNotes('')
    setBankAccountId('')
    setOperationNumber('')
    setBankAccounts([])
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleSubmit() {
    const parsedAmount = parseFloat(amount)
    if (!partnerId || !entityId || isNaN(parsedAmount) || parsedAmount <= 0) return
    if (exchangeRate === null) {
      setError('Exchange rate not available for this date')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await createLoan({
        partner_id: partnerId,
        entity_id: entityId,
        lender_name: entityName ?? '',
        amount: parsedAmount,
        currency,
        exchange_rate: exchangeRate,
        date_borrowed: dateBorrowed,
        project_id: projectId || undefined,
        return_type: returnType,
        agreed_return_rate: returnType === 'percentage' ? parseFloat(agreedReturnRate) || 0 : undefined,
        agreed_return_amount: returnType === 'fixed' ? parseFloat(agreedReturnAmount) || 0 : undefined,
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
        bank_account_id: bankAccountId || undefined,
        operation_number: operationNumber.trim(),
      })

      if (result.error) {
        setError(result.error)
      } else {
        handleClose()
      }
    })
  }

  const parsedAmount = parseFloat(amount)
  const canSubmit = partnerId && entityId && !isNaN(parsedAmount) && parsedAmount > 0 && exchangeRate !== null && operationNumber.trim()

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Loan">
      <div className="space-y-4">
        {/* Partner */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Partner *</label>
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select partner...</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Lender (entity picker) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Lender *</label>
          <EntityPicker
            value={entityId}
            displayName={entityName}
            onChange={(id, name) => { setEntityId(id); setEntityName(name) }}
            placeholder="Search lender by name or document..."
          />
        </div>

        {/* Amount + Currency — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Principal Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Currency *</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className={inputClass}
            >
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Date Borrowed + Due Date — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Date Borrowed *</label>
            <input
              type="date"
              value={dateBorrowed}
              onChange={(e) => setDateBorrowed(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Due Date <span className="font-normal text-faint">(optional)</span></label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Project */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Project <span className="font-normal text-faint">(optional — which project this funded)</span></label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={inputClass}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_code} — {p.name}</option>
            ))}
          </select>
        </div>

        {/* Return Type + Rate/Amount — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Return Type *</label>
            <select
              value={returnType}
              onChange={(e) => setReturnType(e.target.value as 'percentage' | 'fixed')}
              className={inputClass}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>
          <div>
            {returnType === 'percentage' ? (
              <>
                <label className="mb-1 block text-sm font-medium text-ink">Agreed Return Rate % *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={agreedReturnRate}
                  onChange={(e) => setAgreedReturnRate(e.target.value)}
                  placeholder="10.00"
                  className={`${inputClass} font-mono`}
                />
              </>
            ) : (
              <>
                <label className="mb-1 block text-sm font-medium text-ink">Agreed Return Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={agreedReturnAmount}
                  onChange={(e) => setAgreedReturnAmount(e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} font-mono`}
                />
              </>
            )}
          </div>
        </div>

        {/* Bank Account (where the money landed) */}
        {bankAccounts.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Bank Account <span className="font-normal text-faint">(where funds were received)</span></label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select account...</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Operation Number (for disbursement payment) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Operation # *</label>
          <input
            type="text"
            value={operationNumber}
            onChange={(e) => setOperationNumber(e.target.value)}
            placeholder="Numero de operacion"
            className={`${inputClass} font-mono`}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Additional details..."
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-negative">{error}</p>
        )}

        {/* Actions */}
        <ModalActions onCancel={handleClose} onSubmit={handleSubmit} disabled={!canSubmit} isPending={isPending} />
      </div>
    </Modal>
  )
}
