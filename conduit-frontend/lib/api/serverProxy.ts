import { NextRequest, NextResponse } from 'next/server'

const backendBaseURL = process.env.API_BASE_URL ?? 'http://localhost:8080'

export async function proxyRequest(request: NextRequest, targetPath: string) {
  const url = `${backendBaseURL}${targetPath}`

  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer())
  const init: RequestInit = {
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body,
    // no-cache to ensure server-side always proxies fresh
    cache: 'no-store',
  }

  const res = await fetch(url, init)
  const responseBody = await res.text()

  const contentType = res.headers.get('content-type') ?? 'application/json'
  const nextRes = new NextResponse(responseBody, { 
    status: res.status, 
    headers: { 
      'Content-Type': contentType,
      'Cache-Control': 'no-store, max-age=0'
    } 
  })

  // forward set-cookie headers
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) nextRes.headers.set('set-cookie', setCookie)

  return nextRes
}
