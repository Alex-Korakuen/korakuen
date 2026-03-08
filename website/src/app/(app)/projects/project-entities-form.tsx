'use client'

import { useState, useTransition } from 'react'
import { SectionCard } from '@/components/ui/section-card'
import { EntityPicker } from '@/components/ui/entity-picker'
import { addProjectEntity, removeProjectEntity } from '@/lib/actions'
import type { ProjectAssignedEntity } from '@/lib/types'
import { inputCompactClass } from '@/lib/styles'

type Props = {
  projectId: string
  assignedEntities: ProjectAssignedEntity[]
  tags: { id: string; name: string }[]
}

export function ProjectEntitiesForm({ projectId, assignedEntities, tags }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [entityId, setEntityId] = useState<string | null>(null)
  const [entityName, setEntityName] = useState<string | null>(null)
  const [tagId, setTagId] = useState('')

  function handleAdd() {
    if (!entityId || !tagId) return
    setError(null)

    startTransition(async () => {
      try {
        await addProjectEntity(projectId, entityId, tagId)
        setEntityId(null)
        setEntityName(null)
        setTagId('')
        setShowForm(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add entity')
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await removeProjectEntity(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove entity')
      }
    })
  }

  return (
    <SectionCard title="Assigned Entities">
      <div className="px-4 py-2">
        {assignedEntities.length === 0 && !showForm ? (
          <p className="py-4 text-center text-sm text-zinc-400">No entities assigned</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 text-left font-medium">Entity</th>
                <th className="py-1 text-left font-medium">Role</th>
                <th className="py-1 text-right font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {assignedEntities.map((ae) => (
                <tr key={ae.id}>
                  <td className="py-1.5 font-medium text-zinc-700">{ae.entityName}</td>
                  <td className="py-1.5 text-zinc-600">{ae.tagName}</td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => handleRemove(ae.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add form */}
        {showForm ? (
          <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Entity</label>
              <EntityPicker
                value={entityId}
                displayName={entityName}
                onChange={(id, name) => { setEntityId(id); setEntityName(name) }}
                placeholder="Search for entity..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Role</label>
              <select
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                className={`w-full ${inputCompactClass}`}
              >
                <option value="">Select role...</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!entityId || !tagId || isPending}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null); setEntityId(null); setEntityName(null); setTagId('') }}
                className="rounded px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            + Add entity
          </button>
        )}
      </div>
    </SectionCard>
  )
}
