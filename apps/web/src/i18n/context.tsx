'use client'

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
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
const DEFAULT_LOCALE: Locale = 'en'
const LOCALE_CHANGE_EVENT = 'eawp-locale-change'

// ============================================================
// Locale store helpers
// ============================================================

function getInitialLocale(): Locale {
  return DEFAULT_LOCALE
}

function getClientLocaleSnapshot(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'th') {
      return saved
    }

    if (navigator.language.toLowerCase().startsWith('th')) {
      return 'th'
    }
  } catch {
    // localStorage or navigator can be unavailable in edge cases.
  }

  return DEFAULT_LOCALE
}

function subscribeToLocaleChanges(callback: () => void) {
  const handler = () => callback()
  window.addEventListener('storage', handler)
  window.addEventListener(LOCALE_CHANGE_EVENT, handler)

  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(LOCALE_CHANGE_EVENT, handler)
  }
}

// ============================================================
// Provider
// ============================================================

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocaleChanges,
    getClientLocaleSnapshot,
    getInitialLocale
  )

  const setLocale = useCallback((newLocale: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // Ignore
    }
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
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
