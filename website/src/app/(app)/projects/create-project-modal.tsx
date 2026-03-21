'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { ModalActions } from '@/components/ui/modal-actions'
import { EntityPicker } from '@/components/ui/entity-picker'
import { createProject } from '@/lib/actions'
import { inputClass } from '@/lib/styles'
import type { Currency } from '@/lib/types'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectModal({ isOpen, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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

  function resetForm() {
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
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleSubmit() {
    if (!name.trim()) return
    setError(null)

    const parsedValue = contractValue ? parseFloat(contractValue) : undefined

    startTransition(async () => {
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
      })
      if (result.error) {
        setError(result.error)
      } else {
        handleClose()
      }
    })
  }

  const canSubmit = name.trim()

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
