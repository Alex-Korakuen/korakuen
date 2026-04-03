'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/modal'
import { ModalActions } from '@/components/ui/modal-actions'
import { EntityPicker } from '@/components/ui/entity-picker'
import { createProject } from '@/lib/actions'
import { inputClass } from '@/lib/styles'
import { formatPercentage } from '@/lib/formatters'
import type { Currency, PartnerOption } from '@/lib/types'
import { useModalForm } from '@/lib/use-modal-form'

type PartnerEntry = { partnerId: string; profitSharePct: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  partnerOptions: PartnerOption[]
}

export function CreateProjectModal({ isOpen, onClose, partnerOptions }: Props) {
  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState<'subcontractor' | 'oxi'>('subcontractor')
  const [status, setStatus] = useState<'prospect' | 'active' | 'completed' | 'cancelled'>('prospect')
  const [clientEntityId, setClientEntityId] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [contractValue, setContractValue] = useState('')
  const [contractCurrency, setContractCurrency] = useState<Currency>('PEN')
  const [startDate, setStartDate] = useState('')
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [partners, setPartners] = useState<PartnerEntry[]>([])

  const resetFields = useCallback(() => {
    setName('')
    setProjectType('subcontractor')
    setStatus('prospect')
    setClientEntityId(null)
    setClientName(null)
    setContractValue('')
    setContractCurrency('PEN')
    setStartDate('')
    setExpectedEndDate('')
    setLocation('')
    setNotes('')
    setPartners([])
  }, [])

  const { isPending, error, handleClose, submit } = useModalForm(onClose, resetFields)

  const partnerTotal = partners.reduce((s, p) => s + (parseFloat(p.profitSharePct) || 0), 0)
  const availablePartners = partnerOptions.filter(po => !partners.some(p => p.partnerId === po.id))

  function addPartner() {
    if (availablePartners.length === 0) return
    setPartners(prev => [...prev, { partnerId: availablePartners[0].id, profitSharePct: '' }])
  }

  function removePartner(index: number) {
    setPartners(prev => prev.filter((_, i) => i !== index))
  }

  function updatePartner(index: number, field: keyof PartnerEntry, value: string) {
    setPartners(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function handleSubmit() {
    if (!name.trim()) return

    const parsedValue = contractValue ? parseFloat(contractValue) : undefined

    const parsedPartners = partners.length > 0
      ? partners.map(p => ({ partnerId: p.partnerId, profitSharePct: parseFloat(p.profitSharePct) || 0 }))
      : undefined

    submit(async () => {
      const result = await createProject({
        name: name.trim(),
        project_type: projectType,
        status,
        client_entity_id: clientEntityId || undefined,
        contract_value: parsedValue && !isNaN(parsedValue) ? parsedValue : undefined,
        contract_currency: parsedValue && !isNaN(parsedValue) ? contractCurrency : undefined,
        start_date: startDate || undefined,
        expected_end_date: expectedEndDate || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        partners: parsedPartners,
      })
      if (result.error) return { error: result.error }
      return {}
    })
  }

  const partnersValid = partners.length === 0 || Math.abs(partnerTotal - 100) < 0.01
  const canSubmit = name.trim() && partnersValid

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Project">
      <div className="space-y-4">
        <p className="text-xs text-muted">Project code will be auto-generated (PRY001, PRY002...)</p>

        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Project Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Pista Huancayo Tramo 2"
            className={inputClass}
          />
        </div>

        {/* Project Type + Status — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Project Type *</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as 'subcontractor' | 'oxi')}
              className={inputClass}
            >
              <option value="subcontractor">Subcontractor</option>
              <option value="oxi">OxI</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'prospect' | 'active' | 'completed' | 'cancelled')}
              className={inputClass}
            >
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Client */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Client <span className="font-normal text-faint">(optional)</span>
          </label>
          <EntityPicker
            value={clientEntityId}
            displayName={clientName}
            onChange={(id, name) => { setClientEntityId(id); setClientName(name) }}
            placeholder="Search for client entity..."
          />
        </div>

        {/* Contract Value + Currency — side by side */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-ink">
              Contract Value <span className="font-normal text-faint">(optional)</span>
            </label>
            <input
              type="number"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className={`${inputClass} font-mono`}
            />
          </div>
          {contractValue && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Currency</label>
              <select
                value={contractCurrency}
                onChange={(e) => setContractCurrency(e.target.value as Currency)}
                className={inputClass}
              >
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          )}
        </div>

        {/* Dates — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Start Date <span className="font-normal text-faint">(optional)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Expected End <span className="font-normal text-faint">(optional)</span>
            </label>
            <input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Location <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Region in Peru"
            className={inputClass}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Notes <span className="font-normal text-faint">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        {/* Partners */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Partners</label>
          {partners.length > 0 && (
            <div className="space-y-2 mb-2">
              {partners.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={p.partnerId}
                    onChange={(e) => updatePartner(i, 'partnerId', e.target.value)}
                    className={`${inputClass} flex-1`}
                  >
                    {partnerOptions
                      .filter(po => po.id === p.partnerId || !partners.some(pp => pp.partnerId === po.id))
                      .map(po => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={p.profitSharePct}
                      onChange={(e) => updatePartner(i, 'profitSharePct', e.target.value)}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.01"
                      className={`${inputClass} w-20 text-right font-mono`}
                    />
                    <span className="text-sm text-muted">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePartner(i)}
                    className="rounded p-1 text-faint transition-colors hover:text-negative"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-medium ${Math.abs(partnerTotal - 100) < 0.01 ? 'text-positive' : 'text-negative'}`}>
                  Total: {formatPercentage(partnerTotal)}
                </span>
                {Math.abs(partnerTotal - 100) >= 0.01 && (
                  <span className="text-faint">(must be 100%)</span>
                )}
              </div>
            </div>
          )}
          {availablePartners.length > 0 && (
            <button
              type="button"
              onClick={addPartner}
              className="text-xs font-medium text-accent hover:text-accent-hover"
            >
              + Add partner
            </button>
          )}
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
