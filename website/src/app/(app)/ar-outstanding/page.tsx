import {
  getArOutstanding,
  getRetencionDashboard,
  getArDetracciones,
  getProjectsForFilter,
  getClientsForFilter,
  getPartnerCompaniesForFilter,
  getLatestExchangeRate,
} from '@/lib/queries'
import { ArOutstandingClient } from './ar-outstanding-client'

export default async function ArOutstandingPage() {
  const [data, retenciones, detracciones, projects, clients, partners, exchangeRate] = await Promise.all([
    getArOutstanding(),
    getRetencionDashboard(),
    getArDetracciones(),
    getProjectsForFilter(),
    getClientsForFilter(),
    getPartnerCompaniesForFilter(),
    getLatestExchangeRate(),
  ])

  return (
    <ArOutstandingClient
      data={data}
      retenciones={retenciones}
      detracciones={detracciones}
      projects={projects}
      clients={clients}
      partners={partners}
      exchangeRate={exchangeRate}
    />
  )
}
