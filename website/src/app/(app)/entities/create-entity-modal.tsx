'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { ModalActions } from '@/components/ui/modal-actions'
import { createEntity } from '@/lib/actions'
import { inputClass } from '@/lib/styles'

type Props = {
  isOpen: boolean
  onClose: () => void
}

const DOC_TYPES_BY_ENTITY: Record<string, string[]> = {
  company: ['RUC'],
  individual: ['DNI', 'CE', 'Pasaporte'],
}

export function CreateEntityModal({ isOpen, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [entityType, setEntityType] = useState('company')
  const [documentType, setDocumentType] = useState('RUC')
  const [documentNumber, setDocumentNumber] = useState('')
  const [legalName, setLegalName] = useState('')
  const [commonName, setCommonName] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [notes, setNotes] = useState('')

  function resetForm() {
    setEntityType('company')
    setDocumentType('RUC')
    setDocumentNumber('')
    setLegalName('')
    setCommonName('')
    setCity('')
    setRegion('')
    setNotes('')
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleEntityTypeChange(type: string) {
    setEntityType(type)
    const validDocs = DOC_TYPES_BY_ENTITY[type] ?? []
    if (!validDocs.includes(documentType)) {
      setDocumentType(validDocs[0] ?? '')
    }
  }

  function handleSubmit() {
    if (!documentNumber.trim() || !legalName.trim()) return
    setError(null)

    startTransition(async () => {
      try {
        await createEntity({
          entity_type: entityType,
          document_type: documentType,
          document_number: documentNumber.trim(),
          legal_name: legalName.trim(),
          common_name: commonName.trim() || undefined,
          city: city.trim() || undefined,
          region: region.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        handleClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create entity')
      }
    })
  }

  const canSubmit = entityType && documentType && documentNumber.trim() && legalName.trim()
  const docTypeOptions = DOC_TYPES_BY_ENTITY[entityType] ?? []

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Entity">
      <div className="space-y-4">
        {/* Entity Type + Document Type — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Entity Type *</label>
            <select
              value={entityType}
              onChange={(e) => handleEntityTypeChange(e.target.value)}
              className={inputClass}
            >
              <option value="company">Company</option>
              <option value="individual">Individual</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Document Type *</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className={inputClass}
            >
              {docTypeOptions.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Document Number */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Document Number *</label>
          <input
            type="text"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder={documentType === 'RUC' ? '20123456789' : '12345678'}
            className={`${inputClass} font-mono`}
          />
        </div>

        {/* Legal Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Legal Name *</label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Razon social or full name"
            className={inputClass}
          />
        </div>

        {/* Common Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Common Name <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={commonName}
            onChange={(e) => setCommonName(e.target.value)}
            placeholder="Short or trade name"
            className={inputClass}
          />
        </div>

        {/* City + Region — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              City <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Region <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Peruvian department"
              className={inputClass}
            />
          </div>
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
            className={inputClass}
          />
        </div>

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
