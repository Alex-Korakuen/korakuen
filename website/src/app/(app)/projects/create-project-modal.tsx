'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { EntityPicker } from '@/components/ui/entity-picker'
import { createProject } from '@/lib/actions'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectModal({ isOpen, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState('subcontractor')
  const [status, setStatus] = useState('prospect')
  const [clientEntityId, setClientEntityId] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [contractValue, setContractValue] = useState('')
  const [contractCurrency, setContractCurrency] = useState('PEN')
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
      try {
        await createProject({
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
        handleClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create project')
      }
    })
  }

  const canSubmit = name.trim()

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Project">
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">Project code will be auto-generated (PRY001, PRY002...)</p>

        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Project Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Pista Huancayo Tramo 2"
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Project Type + Status — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Project Type *</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="subcontractor">Subcontractor</option>
              <option value="oxi">OxI</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Client <span className="font-normal text-zinc-400">(optional)</span>
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
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Contract Value <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="number"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          {contractValue && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Currency</label>
              <select
                value={contractCurrency}
                onChange={(e) => setContractCurrency(e.target.value)}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Start Date <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Expected End <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Location <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Region in Peru"
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Notes <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
