import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const createdAt = data.user?.created_at;
      const isNewUser = createdAt
        ? Date.now() - new Date(createdAt).getTime() < 60_000
        : false;
      const dest = isNewUser ? `${origin}/dashboard?new_user=1` : `${origin}/dashboard`;
      return NextResponse.redirect(dest);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
