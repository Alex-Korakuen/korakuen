'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Props = {
  paramName?: string
  placeholder?: string
  defaultValue?: string
  label?: string        // default "Search", pass "" to hide
  showButton?: boolean  // default true
}

export function SearchInput({ paramName = 'search', placeholder = 'Search…', defaultValue = '', label = 'Search', showButton = true }: Props) {
  const [value, setValue] = useState(defaultValue)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  function submit() {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) {
      params.set(paramName, value.trim())
    } else {
      params.delete(paramName)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-muted">{label}</label>}
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder={placeholder}
          className="w-full rounded border border-edge bg-white px-3 py-1.5 text-sm text-ink"
        />
        {showButton && (
          <button
            onClick={submit}
            className="rounded border border-edge bg-white px-3 py-1.5 text-sm text-muted hover:bg-surface"
          >
            Go
          </button>
        )}
      </div>
    </div>
  )
}
