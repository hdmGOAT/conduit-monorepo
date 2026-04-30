import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string, user_id: string }> }) {
  const { id, user_id } = await params
  return proxyRequest(request, `/api/groups/${id}/memberships/${user_id}`)
}
