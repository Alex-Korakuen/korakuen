import { getProjectDetail, getPartners, getProjectCategories } from '@/lib/queries'
import { ProjectDetailView } from './project-detail-view'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params

  const [detail, partners, categories] = await Promise.all([
    getProjectDetail(id).catch((err) => { console.error('Failed to load project detail:', err); return null }),
    getPartners(),
    getProjectCategories(),
  ])

  if (!detail) notFound()

  return (
    <ProjectDetailView
      detail={detail}
      partnerOptions={partners}
      categories={categories}
    />
  )
}
