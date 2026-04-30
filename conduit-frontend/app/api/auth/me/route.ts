import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export async function GET(request: NextRequest) {
  return proxyRequest(request, '/api/auth/me')
}