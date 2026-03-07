import { getApCalendar, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { ApCalendarClient } from './ap-calendar-client'

export default async function ApCalendarPage() {
  const partnerIds = await getPartnerFilter()
  const [data, projects, exchangeRate] = await Promise.all([
    getApCalendar(partnerIds),
    getProjectsForFilter(),
    getLatestExchangeRate(),
  ])

  return (
    <ApCalendarClient
      data={data}
      projects={projects}
      exchangeRate={exchangeRate}
    />
  )
}
