'use client'

import { create } from 'zustand'

// ============================================================
// Types
// ============================================================

export type ViewName =
  | 'dashboard'
  | 'projects'
  | 'project-detail'
  | 'requests'
  | 'request-detail'
  | 'request-create'
  | 'work-items'
  | 'meetings'
  | 'meeting-detail'
  | 'uat'
  | 'bugs'
  | 'bug-detail'
  | 'prompts'
  | 'prompt-detail'
  | 'prompt-editor'
  | 'maintenance'
  | 'notifications'
  | 'ai-intake'
  | 'admin'
  | 'admin-users'
  | 'admin-roles'
  | 'admin-departments'
  | 'admin-approval-workflows'
  | 'admin-notification-rules'
  | 'admin-smtp'
  | 'admin-email-templates'
  | 'admin-email-logs'
  | 'admin-github'
  | 'admin-ai-settings'
  | 'admin-prompt-studio'
  | 'admin-document-numbers'
  | 'admin-system-settings'
  | 'admin-audit-logs'
  | 'admin-jobs'
  | 'admin-github-logs'
  | 'admin-menus'
  | 'admin-google-settings'
  | 'profile'
  | 'action-inbox'
  | 'change-requests'
  | 'reports'
  | 'activity-daily'
  | 'calendar'
  | 'platform-request'
  | 'platform-request-create'
  | 'platform-request-detail'

interface NavigationEntry {
  view: string
  params: Record<string, string>
}

interface AppState {
  // Auth
  user: Record<string, unknown> | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => void
  loginWithGoogleCallback: (accessToken: string, refreshToken: string, user: Record<string, unknown>) => void
  logout: () => void
  refreshAuth: () => Promise<void>
  restoreAuth: () => void

  // Navigation
  currentView: string
  viewParams: Record<string, string>
  navigate: (view: string, params?: Record<string, string>) => void
  goBack: () => void
  navigationHistory: NavigationEntry[]

  // Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Menu version (triggers sidebar re-fetch)
  menuVersion: number
  incrementMenuVersion: () => void
}

// ============================================================
// Token Refresh Timer
// ============================================================

let refreshTimer: ReturnType<typeof setTimeout> | null = null

function scheduleTokenRefresh(refreshFn: () => Promise<void>) {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
  // Refresh token 14 minutes after login (access token expires in 15 min)
  refreshTimer = setTimeout(() => {
    refreshFn()
  }, 14 * 60 * 1000)
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

// ============================================================
// LocalStorage helpers
// ============================================================

const STORAGE_KEYS = {
  user: 'eawp_user',
  accessToken: 'eawp_access_token',
  refreshToken: 'eawp_refresh_token',
  theme: 'eawp_theme',
}

function saveToLocalStorage(data: {
  user: Record<string, unknown> | null
  accessToken: string | null
  refreshToken: string | null
}) {
  if (data.user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user))
  } else {
    localStorage.removeItem(STORAGE_KEYS.user)
  }
  if (data.accessToken) {
    localStorage.setItem(STORAGE_KEYS.accessToken, data.accessToken)
  } else {
    localStorage.removeItem(STORAGE_KEYS.accessToken)
  }
  if (data.refreshToken) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken)
  } else {
    localStorage.removeItem(STORAGE_KEYS.refreshToken)
  }
}

function loadFromLocalStorage() {
  if (typeof window === 'undefined') return null

  const userStr = localStorage.getItem(STORAGE_KEYS.user)
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken)
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)

  if (!userStr || !accessToken) return null

  try {
    const user = JSON.parse(userStr)
    return { user, accessToken, refreshToken }
  } catch {
    return null
  }
}

function clearLocalStorage() {
  localStorage.removeItem(STORAGE_KEYS.user)
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
}

// ============================================================
// Store
// ============================================================

export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }

    const { user, accessToken, refreshToken } = data

    saveToLocalStorage({ user, accessToken, refreshToken })

    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      currentView: 'dashboard',
      viewParams: {},
      navigationHistory: [],
    })

    scheduleTokenRefresh(get().refreshAuth)
  },

  loginWithGoogle: () => {
    // Redirect to Google OAuth login endpoint
    window.location.href = '/api/auth/google/login'
  },

  loginWithGoogleCallback: (accessToken: string, refreshToken: string, user: Record<string, unknown>) => {
    saveToLocalStorage({ user, accessToken, refreshToken })

    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      currentView: 'dashboard',
      viewParams: {},
      navigationHistory: [],
    })

    scheduleTokenRefresh(get().refreshAuth)

    // Clean up URL params
    window.history.replaceState({}, document.title, '/')
  },

  logout: async () => {
    const { refreshToken } = get()
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // Ignore logout API errors
    }

    clearRefreshTimer()
    clearLocalStorage()

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      currentView: 'dashboard',
      viewParams: {},
      navigationHistory: [],
    })
  },

  refreshAuth: async () => {
    const { refreshToken } = get()
    if (!refreshToken) {
      get().logout()
      return
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        get().logout()
        return
      }

      const data = await response.json()
      const newAccessToken = data.accessToken

      saveToLocalStorage({
        user: get().user,
        accessToken: newAccessToken,
        refreshToken,
      })

      set({ accessToken: newAccessToken })

      scheduleTokenRefresh(get().refreshAuth)
    } catch {
      get().logout()
    }
  },

  restoreAuth: () => {
    const stored = loadFromLocalStorage()
    if (stored) {
      set({
        user: stored.user,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        isAuthenticated: true,
      })
      scheduleTokenRefresh(get().refreshAuth)

      // Restore theme
      const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) as 'light' | 'dark' | null
      if (savedTheme) {
        set({ theme: savedTheme })
        document.documentElement.classList.toggle('dark', savedTheme === 'dark')
      }
    }
  },

  // Navigation
  currentView: 'dashboard',
  viewParams: {},
  navigationHistory: [],

  navigate: (view: string, params: Record<string, string> = {}) => {
    const { currentView, viewParams } = get()
    set((state) => ({
      navigationHistory: [
        ...state.navigationHistory,
        { view: currentView, params: viewParams },
      ],
      currentView: view,
      viewParams: params,
    }))
  },

  goBack: () => {
    const { navigationHistory } = get()
    if (navigationHistory.length === 0) return

    const lastEntry = navigationHistory[navigationHistory.length - 1]
    set((state) => ({
      currentView: lastEntry.view,
      viewParams: lastEntry.params,
      navigationHistory: state.navigationHistory.slice(0, -1),
    }))
  },

  // Theme
  theme: 'light',

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light'
    set({ theme: newTheme })
    localStorage.setItem(STORAGE_KEYS.theme, newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  },

  // Sidebar
  sidebarCollapsed: false,

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  // Menu version
  menuVersion: 0,

  incrementMenuVersion: () => {
    set((state) => ({ menuVersion: state.menuVersion + 1 }))
  },
}))
