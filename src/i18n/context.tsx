'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import en from './translations/en'
import th from './translations/th'
import type { TranslationKeys } from './translations/en'

// ============================================================
// Types
// ============================================================

export type Locale = 'en' | 'th'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslationKeys
}

// ============================================================
// Translation map
// ============================================================

const translations: Record<Locale, TranslationKeys> = { en, th }

// ============================================================
// Context
// ============================================================

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'eawp_locale'

// ============================================================
// Helper to get initial locale (called once during useState init)
// ============================================================

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved && (saved === 'en' || saved === 'th')) {
      return saved
    }
    // Default to Thai for Thai browsers
    const browserLang = navigator.language.toLowerCase()
    if (browserLang.startsWith('th')) {
      return 'th'
    }
  } catch {
    // localStorage not available
  }
  return 'en'
}

// ============================================================
// Provider
// ============================================================

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // Ignore
    }
    // Update HTML lang attribute
    document.documentElement.lang = newLocale
  }, [])

  // Set HTML lang on initial load
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: translations[locale],
  }), [locale, setLocale])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

// ============================================================
// Hook
// ============================================================

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

// Convenience hook that returns just the translation function
export function useTranslation(): TranslationKeys {
  const { t } = useI18n()
  return t
}

// Convenience hook that returns locale and setter
export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const { locale, setLocale } = useI18n()
  return { locale, setLocale }
}
