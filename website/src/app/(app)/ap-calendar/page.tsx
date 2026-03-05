import { isCompanyView } from '@/lib/auth'
import { getApCalendar, getDetractionsPending, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { ApCalendarClient } from './ap-calendar-client'

export default async function ApCalendarPage() {
  const isAlex = await isCompanyView()
  const [data, detractions, projects, exchangeRate] = await Promise.all([
    getApCalendar(isAlex),
    getDetractionsPending(),
    getProjectsForFilter(),
    getLatestExchangeRate(),
  ])

  return (
    <ApCalendarClient
      data={data}
      detractions={detractions}
      projects={projects}
      isAlex={isAlex}
      exchangeRate={exchangeRate}
    />
  )
}
