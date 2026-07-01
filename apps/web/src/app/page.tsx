'use client'

import { useEffect, useRef, lazy, Suspense } from 'react'
import { useAppStore } from '@/store/app-store'
import { Loader2 } from 'lucide-react'

const LoginPage = lazy(() => import('@/components/login-page'))
const AppLayout = lazy(() => import('@/components/app-layout'))

function FullPageLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function HomePage() {
  const { isAuthenticated, restoreAuth, loginWithGoogleCallback } = useAppStore()
  const hasRestored = useRef(false)

  useEffect(() => {
    if (!hasRestored.current) {
      // Check for Google login callback parameters
      const params = new URLSearchParams(window.location.search)
      const googleLogin = params.get('google_login')

      if (googleLogin === 'success') {
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const userStr = params.get('user')

        if (accessToken && refreshToken && userStr) {
          try {
            const user = JSON.parse(decodeURIComponent(userStr))
            loginWithGoogleCallback(accessToken, refreshToken, user)
            hasRestored.current = true
            return
          } catch {
            // Fall through to normal restore
          }
        }
      }

      // Check for error from Google login
      const error = params.get('error')
      if (error) {
        // Clean up URL and show login page
        window.history.replaceState({}, document.title, '/')
      }

      restoreAuth()
      hasRestored.current = true
    }
  }, [restoreAuth, loginWithGoogleCallback])

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <LoginPage />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<FullPageLoader />}>
      <AppLayout />
    </Suspense>
  )
}
