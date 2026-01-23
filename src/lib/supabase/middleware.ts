import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPage = pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/update-password')

  // Check if auth cookies exist (fast, no network call)
  const hasAuthCookie = request.cookies.getAll().some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')
  )

  // No auth cookies + not on public page → redirect to login immediately
  if (!hasAuthCookie && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // No auth cookies + on public page → just pass through (no Supabase call needed)
  if (!hasAuthCookie && isPublicPage) {
    return NextResponse.next({ request })
  }

  // Has auth cookies → refresh session via getUser()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Session expired/invalid → redirect to login
  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated user on login page → redirect to dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
