import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  // Refresh session — must be called before any auth checks
  const { data: { user } } = await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    // Exclude static assets AND the streaming setlist route: middleware in the
    // path buffers the SSE response until it fully completes (~60-90s), so mobile
    // clients time out waiting for the first byte. The route authenticates itself
    // via createClient()/getUser(), so it doesn't need the session-refresh here.
    '/((?!_next/static|_next/image|favicon.ico|api/generate-setlist|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
