'use client'

import { useState, useRef, useTransition, useCallback, useId } from 'react'
import { searchEntitiesAction } from '@/lib/actions'
import { useClickOutside } from '@/lib/use-click-outside'
import { inputClass } from '@/lib/styles'
import type { EntitySearchResult } from '@/lib/types'

type Props = {
  value: string | null
  displayName: string | null
  onChange: (entityId: string | null, entityName: string | null) => void
  placeholder?: string
  className?: string
}

export function EntityPicker({ value, displayName, onChange, placeholder = 'Search entities...', className }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EntitySearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const listboxId = useId()

  useClickOutside(containerRef, useCallback(() => setIsOpen(false), []))

  function handleSearch(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await searchEntitiesAction(q.trim())
          setResults(data)
          setIsOpen(true)
        } catch {
          setResults([])
          setIsOpen(false)
        }
      })
    }, 300)
  }

  function handleSelect(entity: EntitySearchResult) {
    const name = entity.legal_name
    onChange(entity.id, name)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  function handleClear() {
    onChange(null, null)
    setQuery('')
    setResults([])
  }

  // Show selected entity
  if (value && displayName) {
    return (
      <div className="flex items-center gap-2 rounded border border-edge bg-surface px-3 py-2 text-sm">
        <span className="flex-1 text-ink">{displayName}</span>
        <button
          type="button"
          onClick={handleClear}
          className="text-faint hover:text-muted"
          aria-label="Clear selection"
        >
          &times;
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={isOpen && results.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        className={className ?? inputClass}
      />
      {isPending && (
        <span className="absolute right-3 top-2.5 text-xs text-faint">...</span>
      )}
      {isOpen && results.length > 0 && (
        <ul id={listboxId} role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-edge bg-white shadow-lg">
          {results.map((e) => (
            <li key={e.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => handleSelect(e)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent-bg"
              >
                <span className="font-medium text-ink">
                  {e.legal_name}
                </span>
                <span className="ml-2 text-xs text-faint">{e.document_number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {isOpen && results.length === 0 && query.trim().length >= 2 && !isPending && (
        <div className="absolute z-20 mt-1 w-full rounded border border-edge bg-white px-3 py-2 text-sm text-faint shadow-lg">
          No entities found
        </div>
      )}
    </div>
  )
}
