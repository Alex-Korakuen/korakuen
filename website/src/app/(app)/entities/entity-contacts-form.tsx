'use client'

import { useState, useTransition } from 'react'
import { addEntityContact, removeEntityContact } from '@/lib/actions'
import type { EntityContact } from '@/lib/types'
import { inputCompactClass } from '@/lib/styles'

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

  function handleAdd() {
    if (!name.trim()) return
    startTransition(async () => {
      await addEntityContact(entityId, {
        full_name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        role: role.trim() || undefined,
      })
      setName('')
      setPhone('')
      setEmail('')
      setRole('')
      setShowForm(false)
    })
  }

  function handleRemove(contactId: string) {
    startTransition(async () => {
      await removeEntityContact(contactId)
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
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contacts.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-blue-50">
                  <td className="px-4 py-2 text-zinc-800">{c.full_name}</td>
                  <td className="px-4 py-2 text-zinc-600">{c.role ?? '—'}</td>
                  <td className="px-4 py-2 text-zinc-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2 text-zinc-600">{c.email ?? '—'}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemove(c.id)}
                      disabled={isPending}
                      className="rounded p-0.5 text-zinc-300 transition-colors hover:text-red-500"
                      title="Remove contact"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
