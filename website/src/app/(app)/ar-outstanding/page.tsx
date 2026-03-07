import {
  getArOutstanding,
  getProjectsForFilter,
  getClientsForFilter,
  getPartnerCompaniesForFilter,
  getLatestExchangeRate,
} from '@/lib/queries'
import { ArOutstandingClient } from './ar-outstanding-client'

export default async function ArOutstandingPage() {
  const [data, projects, clients, partners, exchangeRate] = await Promise.all([
    getArOutstanding(),
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
