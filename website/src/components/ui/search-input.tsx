'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Props = {
  paramName?: string
  placeholder?: string
  defaultValue?: string
}

export function SearchInput({ paramName = 'search', placeholder = 'Search…', defaultValue = '' }: Props) {
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
      <label className="text-xs font-medium text-zinc-500">Search</label>
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder={placeholder}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
        />
        <button
          onClick={submit}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Go
        </button>
      </div>
    </div>
  )
}
