import {
  getArOutstanding,
  getProjectsForFilter,
  getClientsForFilter,
  getPartnerCompaniesForFilter,
  getLatestExchangeRate,
} from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { ArOutstandingClient } from './ar-outstanding-client'

export default async function ArOutstandingPage() {
  const partnerIds = await getPartnerFilter()
  const [data, projects, clients, partners, exchangeRate] = await Promise.all([
    getArOutstanding(partnerIds),
    getProjectsForFilter(),
    getClientsForFilter(),
    getPartnerCompaniesForFilter(),
    getLatestExchangeRate(),
  ])

  return (
    <ArOutstandingClient
      data={data}
      projects={projects}
      clients={clients}
      partners={partners}
      exchangeRate={exchangeRate}
    />
  )
}
