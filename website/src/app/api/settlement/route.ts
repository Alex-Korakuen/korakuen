import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSettlementDashboard } from '@/lib/queries'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
