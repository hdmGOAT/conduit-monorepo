import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export async function POST(request: NextRequest) {
  return proxyRequest(request, '/api/groups')
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, '/api/groups/owned')
}
