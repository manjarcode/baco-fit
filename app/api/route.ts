import { NextRequest, NextResponse } from 'next/server'

function getQueryApiKey(searchParams: URLSearchParams) {
  for (const [key, value] of searchParams) {
    if (key.toLowerCase() === 'apikey') return value
  }
  return null
}

function getAuthorizationApiKey(request: NextRequest) {
  const header = request.headers.get('authorization')
  if (!header) return null
  const [, token] = header.match(/^(?:token|bearer)\s+(.+)$/i) ?? []
  return token ?? null
}

export async function GET(request: NextRequest) {
  const apiKey =
    request.headers.get('x-api-key') ??
    getAuthorizationApiKey(request) ??
    getQueryApiKey(request.nextUrl.searchParams)
  if (!apiKey || apiKey !== process.env.ENTRIES_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ status: 'ok' })
}
