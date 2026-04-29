import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api/serverProxy'

export const dynamic = 'force-dynamic'

async function forward(request: NextRequest, params: Promise<{ id: string; path: string[] }>) {
  const { id, path } = await params
  return proxyRequest(request, `/api/groups/${id}/collections/${path.join('/')}`)
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; path: string[] }> }) {
  return forward(request, context.params)
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; path: string[] }> }) {
  return forward(request, context.params)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; path: string[] }> }) {
  return forward(request, context.params)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string; path: string[] }> }) {
  return forward(request, context.params)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; path: string[] }> }) {
  return forward(request, context.params)
}