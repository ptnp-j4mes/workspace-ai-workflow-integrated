'use client'

import { useAppStore } from '@/store/app-store'

// ============================================================
// API Client - Typed HTTP client with auth and auto-refresh
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

class ApiClient {
  private getToken(): string | null {
    return useAppStore.getState().accessToken
  }

  private getRefreshToken(): string | null {
    return useAppStore.getState().refreshToken
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return null

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) return null

      const data = await response.json()
      const newAccessToken = data.accessToken

      // Update the store with the new token
      const store = useAppStore.getState()
      const user = store.user
      // Save to localStorage
      if (user) {
        localStorage.setItem('eawp_access_token', newAccessToken)
      }

      useAppStore.setState({ accessToken: newAccessToken })
      return newAccessToken
    } catch {
      return null
    }
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    isRetry: boolean = false
  ): Promise<T> {
    const token = this.getToken()
    const isFormData = body instanceof FormData

    const headers: Record<string, string> = {}
    // Skip Content-Type for FormData - the browser sets the multipart boundary itself.
    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      options.body = isFormData ? body : JSON.stringify(body)
    }

    const response = await fetch(`${API_BASE_URL}${url}`, options)

    // Handle 401 - try to refresh token and retry once
    if (response.status === 401 && !isRetry) {
      const newToken = await this.refreshAccessToken()
      if (newToken) {
        return this.request<T>(method, url, body, true)
      } else {
        // Refresh failed, logout
        useAppStore.getState().logout()
        throw new ApiError('Session expired. Please login again.', 401)
      }
    }

    // Parse response
    let data: unknown
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!response.ok) {
      const errorMessage =
        (data as Record<string, unknown>)?.error ||
        (data as Record<string, unknown>)?.message ||
        `Request failed with status ${response.status}`
      throw new ApiError(
        typeof errorMessage === 'string' ? errorMessage : String(errorMessage),
        response.status,
        data
      )
    }

    return data as T
  }

  async get<T>(url: string): Promise<T> {
    return this.request<T>('GET', url)
  }

  async post<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', url, body)
  }

  async patch<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', url, body)
  }

  async delete<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', url, body)
  }

  async put<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', url, body)
  }
}

export const api = new ApiClient()
export { ApiError }
