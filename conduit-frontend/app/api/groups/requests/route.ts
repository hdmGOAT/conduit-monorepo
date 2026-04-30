import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyRequest(request, '/api/groups/requests')
}
