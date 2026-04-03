import { getEntityDetail, getEntitiesFilterOptions } from '@/lib/queries'
import { EntityDetailView } from './entity-detail-view'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EntityDetailPage({ params }: Props) {
  const { id } = await params

  const [detail, filterOptions] = await Promise.all([
    getEntityDetail(id).catch((err) => { console.error('Failed to load entity detail:', err); return null }),
    getEntitiesFilterOptions(),
  ])

  if (!detail) notFound()

  return (
    <EntityDetailView
      detail={detail}
      availableTags={filterOptions.tags}
    />
  )
}
