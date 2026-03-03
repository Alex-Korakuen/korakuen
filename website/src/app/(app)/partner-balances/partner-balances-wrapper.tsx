'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { PartnerBalancesClient } from './partner-balances-client'
import type { PartnerBalanceData } from '@/lib/types'

type Props = {
  initialData: PartnerBalanceData | null
  projects: { id: string; project_code: string; name: string }[]
  isAlex: boolean
  projectId: string | null
}

export function PartnerBalancesWrapper({
  initialData,
  projects,
  isAlex,
  projectId,
}: Props) {
  const router = useRouter()

  const handleProjectChange = useCallback(
    (newProjectId: string | null) => {
      if (newProjectId) {
        router.push(`/partner-balances?project=${newProjectId}`)
      } else {
        router.push('/partner-balances')
      }
    },
    [router]
  )

  return (
    <PartnerBalancesClient
      data={initialData}
      projects={projects}
      isAlex={isAlex}
      projectId={projectId}
      onProjectChange={handleProjectChange}
    />
  )
}
