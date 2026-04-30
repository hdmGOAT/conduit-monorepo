import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return proxyRequest(request, '/api/webhooks/stripe')
}
