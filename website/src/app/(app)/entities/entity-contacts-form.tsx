'use client'

import { useState, useTransition } from 'react'
import { addEntityContact, removeEntityContact, updateEntityContact } from '@/lib/actions'
import type { EntityContact } from '@/lib/types'
import { inputCompactClass, btnPrimary, btnDangerIcon, iconPencil, iconTrash } from '@/lib/styles'

type Props = {
  entityId: string
  contacts: EntityContact[]
}

export function EntityContactsForm({ entityId, contacts }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function startEdit(c: EntityContact) {
    setEditingId(c.id)
    setEditName(c.full_name)
    setEditRole(c.role ?? '')
    setEditPhone(c.phone ?? '')
    setEditEmail(c.email ?? '')
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  function handleSaveEdit() {
    if (!editName.trim()) {
      setEditError('Name is required')
      return
    }
    startTransition(async () => {
      const result = await updateEntityContact(editingId!, {
        full_name: editName.trim(),
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        role: editRole.trim() || undefined,
      })
      if (result.error) {
        setEditError(result.error)
      } else {
        setEditingId(null)
        setEditError(null)
      }
    })
  }

  function handleAdd() {
    if (!name.trim()) return
    setActionError(null)
    startTransition(async () => {
      const result = await addEntityContact(entityId, {
        full_name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        role: role.trim() || undefined,
      })
      if (result.error) {
        setActionError(result.error)
      } else {
        setName('')
        setPhone('')
        setEmail('')
        setRole('')
        setShowForm(false)
      }
    })
  }

  function handleRemove(contactId: string) {
    setActionError(null)
    startTransition(async () => {
      const result = await removeEntityContact(contactId)
      if (result.error) setActionError(result.error)
    })
  }

  return (
    <div>
      {contacts.length === 0 && !showForm ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-500">No contacts</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Phone</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="w-16 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contacts.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id} className="bg-blue-50">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={`${inputCompactClass} w-full bg-white`}
                        placeholder="Name *"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className={`${inputCompactClass} w-full bg-white`}
                        placeholder="Role"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className={`${inputCompactClass} w-full bg-white`}
                        placeholder="Phone"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className={`${inputCompactClass} w-full bg-white`}
                        placeholder="Email"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isPending || !editName.trim()}
                          className="rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isPending ? '...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isPending}
                          className="rounded px-1.5 py-1 text-[11px] text-zinc-500 hover:bg-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                      {editError && (
                        <p className="mt-1 text-[10px] text-red-600">{editError}</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} className="transition-colors hover:bg-blue-50">
                    <td className="px-4 py-2 text-zinc-800">{c.full_name}</td>
                    <td className="px-4 py-2 text-zinc-600">{c.role ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600">{c.phone ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600">{c.email ?? '—'}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          disabled={isPending}
                          className="rounded border border-zinc-200 p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                          title="Edit contact"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d={iconPencil} />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(c.id)}
                          disabled={isPending}
                          className={`${btnDangerIcon}`}
                          title="Remove contact"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d={iconTrash} clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {actionError && (
        <div className="border-t border-zinc-100 px-4 py-2">
          <p className="text-xs text-red-600">{actionError}</p>
        </div>
      )}

      {/* Add contact form */}
      {showForm && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCompactClass}
            />
            <input
              type="text"
              placeholder="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputCompactClass}
            />
            <input
              type="text"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCompactClass}
            />
            <input
              type="text"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCompactClass}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !name.trim()}
              className={`${btnPrimary} text-xs disabled:opacity-50`}
            >
              {isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(''); setPhone(''); setEmail(''); setRole('') }}
              className="rounded px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <div className="border-t border-zinc-100 px-4 py-2">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-blue-600 transition-colors hover:text-blue-800"
          >
            + Add contact
          </button>
        </div>
      )}
    </div>
  )
}
