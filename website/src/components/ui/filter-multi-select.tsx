'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { selectClass } from '@/lib/styles'

type Option = {
  value: string
  label: string
}

type Props = {
  label?: string
  values: string[]
  onChange: (values: string[]) => void
  options: Option[]
  placeholder?: string
}

export function FilterMultiSelect({ label, values, onChange, options, placeholder = 'All' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allSelected = values.length === options.length
  const noneSelected = values.length === 0

  let buttonLabel: string
  if (allSelected || noneSelected) {
    buttonLabel = placeholder
  } else if (values.length === 1) {
    const match = options.find(o => o.value === values[0])
    buttonLabel = match ? match.label : placeholder
  } else {
    buttonLabel = `${values.length} selected`
  }

  function toggleValue(val: string) {
    const next = values.includes(val)
      ? values.filter(v => v !== val)
      : [...values, val]
    if (next.length === 0) return
    onChange(next)
  }

  function toggleAll() {
    if (allSelected) return
    onChange(options.map(o => o.value))
  }

  const select = (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label ? `${label}: ${buttonLabel}` : undefined}
        className={`${selectClass} flex items-center gap-1 pr-6 text-left`}
      >
        {buttonLabel}
        <svg className="absolute right-2 h-3 w-3 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div id={listboxId} role="listbox" aria-multiselectable="true" aria-label={label ?? placeholder} className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[200px] overflow-auto rounded border border-edge bg-white py-1 shadow-lg">
          {/* Select all */}
          <button
            type="button"
            role="option"
            aria-selected={allSelected}
            onClick={toggleAll}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted hover:bg-panel"
          >
            <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${allSelected ? 'border-accent bg-accent text-white' : 'border-edge'}`}>
              {allSelected && (
                <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            Select all
          </button>

          <div role="separator" className="my-1 border-t border-edge" />

          {options.map(opt => {
            const checked = values.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggleValue(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink hover:bg-panel"
              >
                <span aria-hidden="true" className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? 'border-accent bg-accent text-white' : 'border-edge'}`}>
                  {checked && (
                    <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  if (!label) return select

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {select}
    </div>
  )
}
