import { getProjectDetail, getPartnerCompanies, getProjectCategories } from '@/lib/queries'
import { ProjectDetailView } from './project-detail-view'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params

  const [detail, partnerCompanies, categories] = await Promise.all([
    getProjectDetail(id).catch(() => null),
    getPartnerCompanies(),
    getProjectCategories(),
  ])

  if (!detail) notFound()

  return (
    <ProjectDetailView
      detail={detail}
      partnerCompanies={partnerCompanies}
      categories={categories}
    />
  )
}
