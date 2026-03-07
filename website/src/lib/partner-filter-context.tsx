'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

type PartnerCompany = { id: string; name: string }

type PartnerFilterContextType = {
  partners: PartnerCompany[]
  selectedPartnerIds: string[] // empty = all
  togglePartner: (id: string) => void
  clearFilter: () => void
  applyFilter: () => void
  isFiltered: boolean
  isDirty: boolean // true when local state differs from what's been applied
}

const PartnerFilterContext = createContext<PartnerFilterContextType | null>(null)

const COOKIE_NAME = 'partner_filter'

function setCookie(ids: string[]) {
  const value = ids.length > 0 ? ids.join(',') : ''
  document.cookie = `${COOKIE_NAME}=${value};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
}

export function parsePartnerFilterCookie(cookieValue: string | undefined): string[] {
  if (!cookieValue) return []
  return cookieValue.split(',').filter(Boolean)
}

export function PartnerFilterProvider({
  partners,
  initialSelection,
  children,
}: {
  partners: PartnerCompany[]
  initialSelection: string[]
  children: ReactNode
}) {
  const router = useRouter()
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>(initialSelection)
  const [appliedIds, setAppliedIds] = useState<string[]>(initialSelection)

  const togglePartner = useCallback((id: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }, [])

  const clearFilter = useCallback(() => {
    setSelectedPartnerIds([])
    setAppliedIds([])
    setCookie([])
    router.refresh()
  }, [router])

  const applyFilter = useCallback(() => {
    setCookie(selectedPartnerIds)
    setAppliedIds([...selectedPartnerIds])
    router.refresh()
  }, [selectedPartnerIds, router])

  // Check if current selection differs from what's applied
  const isDirty = selectedPartnerIds.length !== appliedIds.length ||
    selectedPartnerIds.some((id) => !appliedIds.includes(id))

  return (
    <PartnerFilterContext.Provider
      value={{
        partners,
        selectedPartnerIds,
        togglePartner,
        clearFilter,
        applyFilter,
        isFiltered: appliedIds.length > 0,
        isDirty,
      }}
    >
      {children}
    </PartnerFilterContext.Provider>
  )
}

export function usePartnerFilter() {
  const ctx = useContext(PartnerFilterContext)
  if (!ctx) throw new Error('usePartnerFilter must be used within PartnerFilterProvider')
  return ctx
}
