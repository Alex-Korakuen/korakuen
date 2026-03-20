'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { ModalActions } from '@/components/ui/modal-actions'
import { createBankAccount } from '@/lib/actions'
import type { PartnerCompanyOption, Currency } from '@/lib/types'
import { inputClass } from '@/lib/styles'

type Props = {
  isOpen: boolean
  onClose: () => void
  partnerCompanies: PartnerCompanyOption[]
}

export function CreateBankAccountModal({ isOpen, onClose, partnerCompanies }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [partnerCompanyId, setPartnerCompanyId] = useState('')
  const [bankName, setBankName] = useState('')
  const [last4, setLast4] = useState('')
  const [label, setLabel] = useState('')
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'detraccion'>('checking')
  const [currency, setCurrency] = useState<Currency>('PEN')

  const isDetraccion = accountType === 'detraccion'

  function resetForm() {
    setPartnerCompanyId('')
    setBankName('')
    setLast4('')
    setLabel('')
    setAccountType('checking')
    setCurrency('PEN')
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  // Auto-suggest label when bank name and last4 change
  function updateLabel(newBankName: string, newLast4: string) {
    if (newBankName && newLast4.length === 4) {
      setLabel(`${newBankName}-${newLast4}`)
    }
  }

  function handleSubmit() {
    if (!partnerCompanyId || !bankName.trim() || last4.length !== 4 || !label.trim()) return
    setError(null)

    startTransition(async () => {
      const result = await createBankAccount({
        partner_company_id: partnerCompanyId,
        bank_name: bankName.trim(),
        account_number_last4: last4,
        label: label.trim(),
        account_type: accountType,
        currency,
        is_detraccion_account: isDetraccion,
      })
      if (result.error) {
        setError(result.error)
      } else {
        handleClose()
      }
    })
  }

  const canSubmit = partnerCompanyId && bankName.trim() && last4.length === 4 && label.trim()

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Bank Account">
      <div className="space-y-4">
        {/* Partner Company */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Partner Company *</label>
          <select
            value={partnerCompanyId}
            onChange={(e) => setPartnerCompanyId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select partner...</option>
            {partnerCompanies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Bank Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Bank Name *</label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => { setBankName(e.target.value); updateLabel(e.target.value, last4) }}
            placeholder="BCP, Interbank, BBVA..."
            className={inputClass}
          />
        </div>

        {/* Last 4 digits */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Account Number (last 4) *</label>
          <input
            type="text"
            value={last4}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              setLast4(v)
              updateLabel(bankName, v)
            }}
            placeholder="1234"
            maxLength={4}
            className={`${inputClass} font-mono`}
          />
        </div>

        {/* Label */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Label * <span className="font-normal text-zinc-400">(unique identifier)</span></label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="BCP-1234"
            className={inputClass}
          />
        </div>

        {/* Account Type + Currency — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Account Type *</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as 'checking' | 'savings' | 'detraccion')}
              className={inputClass}
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="detraccion">Detraccion</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Currency *</label>
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

        {/* Detraccion indicator */}
        {isDetraccion && (
          <p className="text-xs text-amber-600">
            Detraccion accounts are restricted to tax payments only (Banco de la Nacion).
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <ModalActions onCancel={handleClose} onSubmit={handleSubmit} disabled={!canSubmit} isPending={isPending} />
      </div>
    </Modal>
  )
}
