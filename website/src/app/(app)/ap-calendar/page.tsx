import { isCompanyView } from '@/lib/auth'
import { getApCalendar, getDetractionsPending, getProjectsForFilter } from '@/lib/queries'
import { ApCalendarClient } from './ap-calendar-client'

export default async function ApCalendarPage() {
  const isAlex = await isCompanyView()
  const [data, detractions, projects] = await Promise.all([
    getApCalendar(isAlex),
    getDetractionsPending(),
    getProjectsForFilter(),
  ])

  return (
    <ApCalendarClient
      data={data}
      detractions={detractions}
      projects={projects}
      isAlex={isAlex}
    />
  )
}
