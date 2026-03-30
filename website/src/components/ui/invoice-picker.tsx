'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import { searchInvoicesAction } from '@/lib/actions'
import { useClickOutside } from '@/lib/use-click-outside'
import { inputCompactClass } from '@/lib/styles'
import type { InvoiceSearchResult } from '@/lib/types'

type Props = {
  value: string | null
  displayLabel: string | null
  onChange: (invoiceId: string | null, label: string | null) => void
  placeholder?: string
}

export function InvoicePicker({ value, displayLabel, onChange, placeholder = 'Search by ref or number...' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<InvoiceSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

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
        const data = await searchInvoicesAction(q.trim())
        setResults(data)
        setIsOpen(true)
      })
    }, 300)
  }

  function handleSelect(inv: InvoiceSearchResult) {
    const label = inv.document_ref || inv.invoice_number || inv.title || inv.id.slice(0, 8)
    onChange(inv.id, label)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  function handleClear() {
    onChange(null, null)
    setQuery('')
    setResults([])
  }

  if (value && displayLabel) {
    return (
      <div className="flex items-center gap-2 rounded border border-edge bg-surface px-3 py-1.5 text-sm">
        <span className="flex-1 text-ink">{displayLabel}</span>
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
        className={`${inputCompactClass} w-full bg-white`}
      />
      {isPending && (
        <span className="absolute right-3 top-2 text-xs text-faint">...</span>
      )}
      {isOpen && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-edge bg-white shadow-lg">
          {results.map((inv) => (
            <li key={inv.id}>
              <button
                type="button"
                onClick={() => handleSelect(inv)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent-bg"
              >
                <span className="font-medium text-ink">
                  {inv.document_ref || inv.invoice_number || '(no ref)'}
                </span>
                {inv.entity_name && (
                  <span className="ml-2 text-xs text-faint">{inv.entity_name}</span>
                )}
                <span className="ml-2 text-xs text-muted">
                  {inv.direction === 'payable' ? 'AP' : 'AR'} {inv.currency}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {isOpen && results.length === 0 && query.trim().length >= 2 && !isPending && (
        <div className="absolute z-20 mt-1 w-full rounded border border-edge bg-white px-3 py-2 text-sm text-faint shadow-lg">
          No invoices found
        </div>
      )}
    </div>
  )
}
