import { isCompanyView } from '@/lib/auth'
import { getApCalendar, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { ApCalendarClient } from './ap-calendar-client'

export default async function ApCalendarPage() {
  const isAlex = await isCompanyView()
  const [data, projects, exchangeRate] = await Promise.all([
    getApCalendar(isAlex),
    getProjectsForFilter(),
    getLatestExchangeRate(),
  ])

  return (
    <ApCalendarClient
      data={data}
      projects={projects}
      isAlex={isAlex}
      exchangeRate={exchangeRate}
    />
  )
}
