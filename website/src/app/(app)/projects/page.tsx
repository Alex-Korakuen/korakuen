import { getProjectsList, getProjectDetail, getPartnerCompanies, getProjectCategories, getTags } from '@/lib/queries'
import { ProjectsWrapper } from './projects-wrapper'

type Props = {
  searchParams: Promise<{ selected?: string }>
}

export default async function ProjectsPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedId = params.selected || null

  const [projects, partnerCompanies, categories, tags, detail] = await Promise.all([
    getProjectsList(),
    getPartnerCompanies(),
    getProjectCategories(),
    getTags(),
    selectedId ? getProjectDetail(selectedId) : Promise.resolve(null),
  ])

  return (
    <ProjectsWrapper
      projects={projects}
      detail={detail}
      selectedId={selectedId}
      partnerCompanies={partnerCompanies}
      categories={categories}
      tags={tags}
    />
  )
}
