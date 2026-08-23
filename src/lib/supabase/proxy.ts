import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) return response

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const protectedPrefixes = [
    '/dashboard',
    '/my-pokemon',
    '/moves',
    '/type-analysis',
    '/evolutions',
  ]
  const requiresAuthentication = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  )

  if (requiresAuthentication && !data?.claims?.sub) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
