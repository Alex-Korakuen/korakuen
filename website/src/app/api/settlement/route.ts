import { NextRequest, NextResponse } from 'next/server'
import { getSettlementDashboard } from '@/lib/queries'

export async function POST(request: NextRequest) {
  const { projectIds } = await request.json()

  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return NextResponse.json(
      { error: 'projectIds must be a non-empty array' },
      { status: 400 },
    )
  }

  const data = await getSettlementDashboard(projectIds)
  return NextResponse.json(data)
}
