import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, `/api/groups/${id}`)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, `/api/groups/${id}`)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, `/api/groups/${id}`)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, `/api/groups/${id}`)
}
