import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Safety check for environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Middleware Error: Missing Supabase environment variables')
    return response // Proceed without auth processing if env vars are missing
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            response = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // This will refresh session if needed - required for Server Components
    const { data: { user }, error } = await supabase.auth.getUser()

    // PROTECTED ROUTES LOGIC
    // If no user (or error), and trying to access protected routes, redirect to login
    const path = request.nextUrl.pathname
    const isProtectedRoute = path.startsWith('/dashboard') || path.startsWith('/admin')
    const isAuthRoute = path === '/login' || path === '/signup' || path === '/setup'

    if ((!user || error) && isProtectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Optional: If user IS logged in and tries to go to /login, redirect to /dashboard
    // DISABLED: Allow logged-in users to access login page for sign-out
    // if (user && isAuthRoute) {
    //   const url = request.nextUrl.clone()
    //   url.pathname = '/dashboard'
    //   return NextResponse.redirect(url)
    // }

    return response
  } catch (error) {
    console.error('Middleware Error:', error)
    return response
  }
}
