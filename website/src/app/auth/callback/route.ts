import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { DEFAULT_ROUTE } from '@/lib/constants'

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
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // setAll called from Server Component — safe to ignore
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if this is an invited user who needs to set their password.
      // Supabase invite links include type=invite in the URL fragment,
      // but after code exchange we can check the user's metadata.
      const { data: { user } } = await supabase.auth.getUser()
      const isNewInvite = user && !user.user_metadata?.password_set

      if (isNewInvite) {
        return NextResponse.redirect(`${origin}/auth/set-password`)
      }

      return NextResponse.redirect(`${origin}${DEFAULT_ROUTE}`)
    }
  }

  // If code is missing or exchange failed, redirect to login with error hint
  const reason = code ? 'auth_exchange_failed' : 'missing_code'
  return NextResponse.redirect(`${origin}/login?error=${reason}`)
}
