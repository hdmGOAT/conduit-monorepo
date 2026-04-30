import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, `/api/groups/${id}/subscription/checkout`)
}
