'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Zap, Shield, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { LanguageSwitcher } from '@/components/language-switcher'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const login = useAppStore((s) => s.login)
  const loginWithGoogle = useAppStore((s) => s.loginWithGoogle)
  const { t } = useI18n()

  // Check for error in URL params (from Google login failure)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errParam = params.get('error')
    if (errParam) {
      const errorMessages: Record<string, string> = {
        google_login_failed: 'Google login failed. Please try again.',
        token_exchange_failed: 'Failed to authenticate with Google. Please try again.',
        userinfo_failed: 'Failed to get your Google profile. Please try again.',
        no_email: 'No email found in your Google account.',
        account_deactivated: 'Your account has been deactivated.',
        not_configured: 'Google login is not configured. Please contact your administrator.',
        missing_code: 'Authentication code was not received. Please try again.',
      }
      ;(() => setError(errorMessages[errParam] || 'An error occurred during login. Please try again.'))()
      // Clean up URL
      window.history.replaceState({}, document.title, '/')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.auth.loginFailed
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    setGoogleLoading(true)
    setError('')
    loginWithGoogle()
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-spin"
          style={{
            background:
              'conic-gradient(from 0deg, transparent, oklch(0.7 0.12 200 / 0.08), transparent, oklch(0.6 0.1 160 / 0.06), transparent, oklch(0.65 0.11 180 / 0.07), transparent)',
            animationDuration: '30s',
          }}
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>

      {/* Language switcher - top right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Floating decorative elements */}
      <motion.div
        className="absolute left-[10%] top-[15%] rounded-full bg-primary/5"
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 80, height: 80 }}
      />
      <motion.div
        className="absolute right-[15%] top-[25%] rounded-full bg-primary/5"
        animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 60, height: 60 }}
      />
      <motion.div
        className="absolute bottom-[20%] left-[20%] rounded-full bg-primary/5"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 100, height: 100 }}
      />
      <motion.div
        className="absolute bottom-[30%] right-[10%] rounded-full bg-primary/5"
        animate={{ y: [0, 18, 0], rotate: [0, 3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 50, height: 50 }}
      />

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <Card className="border-border/50 shadow-2xl backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-4 pb-4 text-center">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
            >
              <Sparkles className="h-8 w-8 text-primary" />
            </motion.div>

            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Enterprise AI Workflow
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-muted-foreground">
                {t.auth.signInSubtitle}
              </CardDescription>
            </div>

            {/* Feature highlights */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>Smart</span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Google Sign-In Button */}
            <Button
              variant="outline"
              className="h-11 w-full gap-3 mb-4"
              disabled={isLoading || googleLoading}
              size="lg"
              onClick={handleGoogleLogin}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span>{googleLoading ? 'Redirecting to Google...' : t.auth.signInWithGoogle}</span>
            </Button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="h-11 w-full gap-2"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    {t.auth.signInButton}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-6 rounded-lg border border-border/50 bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Demo credentials: <span className="font-medium text-foreground/70">admin@enterprise.com</span> / <span className="font-medium text-foreground/70">admin123</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
