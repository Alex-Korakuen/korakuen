'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { searchEntitiesAction } from '@/lib/actions'
import { inputClass } from '@/lib/styles'
import type { EntitySearchResult } from '@/lib/types'

type Props = {
  value: string | null
  displayName: string | null
  onChange: (entityId: string | null, entityName: string | null) => void
  placeholder?: string
}

export function EntityPicker({ value, displayName, onChange, placeholder = 'Search entities...' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EntitySearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
        const data = await searchEntitiesAction(q.trim())
        setResults(data)
        setIsOpen(true)
      })
    }, 300)
  }

  function handleSelect(entity: EntitySearchResult) {
    const name = entity.common_name || entity.legal_name
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
      <div className="flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <span className="flex-1 text-zinc-700">{displayName}</span>
        <button
          type="button"
          onClick={handleClear}
          className="text-zinc-400 hover:text-zinc-600"
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
        className={inputClass}
      />
      {isPending && (
        <span className="absolute right-3 top-2.5 text-xs text-zinc-400">...</span>
      )}
      {isOpen && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-zinc-200 bg-white shadow-lg">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => handleSelect(e)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span className="font-medium text-zinc-800">
                  {e.common_name || e.legal_name}
                </span>
                {e.common_name && e.common_name !== e.legal_name && (
                  <span className="ml-1 text-zinc-500">({e.legal_name})</span>
                )}
                <span className="ml-2 text-xs text-zinc-400">{e.document_number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {isOpen && results.length === 0 && query.trim().length >= 2 && !isPending && (
        <div className="absolute z-20 mt-1 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-400 shadow-lg">
          No entities found
        </div>
      )}
    </div>
  )
}
