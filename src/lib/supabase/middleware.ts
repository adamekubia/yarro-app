import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPage = pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/update-password')

  // Check if auth cookies exist (instant, no network call)
  const hasAuthCookie = request.cookies.getAll().some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')
  )

  // No auth cookies + protected page → redirect to login
  if (!hasAuthCookie && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Has auth cookies + on login page → redirect to dashboard
  if (hasAuthCookie && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // All other cases → pass through instantly
  return NextResponse.next({ request })
}
