'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  User,
  Lock,
  Bell,
  Palette,
  Loader2,
  Save,
  RefreshCw,
  ChevronRight,
  Camera,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface UserProfile {
  id: string
  name: string
  email: string
  phone: string | null
  position: string | null
  timezone: string
  locale: string
  avatarUrl: string | null
  themePreference: string | null
  emailNotificationEnabled: boolean
  inAppNotificationEnabled: boolean
  department: {
    id: string
    name: string
    code: string
    type: string
    description: string | null
    parent: { id: string; name: string; code: string } | null
  } | null
  roles: Array<{ id: string; key: string; name: string }>
  roleKeys: string[]
}

interface NotificationPreference {
  id: string
  eventKey: string
  inAppEnabled: boolean
  emailEnabled: boolean
}

interface JobPosition {
  id: string
  name: string
  code: string
  level: string | null
  category: string | null
  departmentId: string | null
  sortOrder: number
  department?: { id: string; name: string; code: string } | null
}

const TIMEZONES = [
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'UTC',
]

const LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'th-TH', label: 'Thai' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
]

// ============================================================
// Component
// ============================================================

export default function ProfilePage() {
  const { toggleTheme, theme } = useAppStore()
  const { t } = useI18n()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Profile form
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPosition, setFormPosition] = useState('')
  const [formTimezone, setFormTimezone] = useState('Asia/Bangkok')
  const [formLocale, setFormLocale] = useState('th-TH')

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference[]>([])
  const [savingNotifs, setSavingNotifs] = useState(false)

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Master data
  const [positions, setPositions] = useState<JobPosition[]>([])

  const fetchProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: UserProfile }>('/api/me/profile')
      const p = data.data
      setProfile(p)
      setFormName(p.name)
      setFormPhone(p.phone ?? '')
      setFormPosition(p.position ?? '')
      setFormTimezone(p.timezone)
      setFormLocale(p.locale)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifPrefs = async () => {
    try {
      const data = await api.get<{ data: NotificationPreference[] }>('/api/me/notification-preferences')
      setNotifPrefs(data.data ?? [])
    } catch {
      // Ignore
    }
  }

  const fetchPositions = async () => {
    try {
      const data = await api.get<{ data: JobPosition[] }>('/api/master/positions')
      setPositions(data.data ?? [])
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    fetchProfile()
    fetchNotifPrefs()
    fetchPositions()
  }, [])

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.warning('Invalid File', 'Please select a JPG, PNG, GIF, or WebP image.')
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.warning('File Too Large', 'Image must be less than 2MB.')
      return
    }

    setUploadingAvatar(true)
    try {
      // Upload the file
      const formData = new FormData()
      formData.append('file', file)
      const token = useAppStore.getState().accessToken
      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/upload/avatar`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!uploadRes.ok) {
        const errData = await uploadRes.json()
        throw new Error(errData.error || 'Upload failed')
      }

      const { url: avatarUrl } = await uploadRes.json()

      // Update profile with new avatar URL
      await api.patch('/api/me/profile', { avatarUrl })

      // Refresh profile
      await fetchProfile()

      toast.success('Avatar Updated', 'Your profile picture has been updated.')
    } catch (err: unknown) {
      toast.error('Upload Failed', err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [fetchProfile])

  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await api.patch('/api/me/profile', {
        name: formName,
        phone: formPhone || null,
        position: formPosition || null,
        timezone: formTimezone,
        locale: formLocale,
      })
      fetchProfile()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    if (!currentPassword || !newPassword) {
      setPasswordError('Both passwords are required')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    setSaving(true)
    try {
      await api.patch('/api/me/password', {
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleNotifPref = (eventKey: string, field: 'inAppEnabled' | 'emailEnabled') => {
    setNotifPrefs((prev) =>
      prev.map((p) =>
        p.eventKey === eventKey ? { ...p, [field]: !p[field] } : p
      )
    )
  }

  const handleSaveNotifPrefs = async () => {
    setSavingNotifs(true)
    try {
      await api.patch('/api/me/notification-preferences', {
        preferences: notifPrefs.map((p) => ({
          eventKey: p.eventKey,
          inAppEnabled: p.inAppEnabled,
          emailEnabled: p.emailEnabled,
        })),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSavingNotifs(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchProfile} className="gap-2">
          <RefreshCw className="h-4 w-4" /> {t.common.retry}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.profile.title}</h1>
          <p className="text-sm text-muted-foreground">{t.profile.subtitle}</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-1">
            <User className="h-4 w-4 hidden sm:block" /> {t.profile.title}
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-1">
            <Lock className="h-4 w-4 hidden sm:block" /> {t.profile.changePassword}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1">
            <Bell className="h-4 w-4 hidden sm:block" /> {t.common.notifications}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1">
            <Palette className="h-4 w-4 hidden sm:block" /> {t.common.theme}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          {/* Avatar Section */}
          <Card className="mb-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className="group relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.name ?? 'User'} />
                    <AvatarFallback className="text-2xl">
                      {profile?.name ? getInitials(profile.name) : '??'}
                    </AvatarFallback>
                  </Avatar>
                  {/* Camera overlay button */}
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100 disabled:cursor-not-allowed"
                    aria-label="Upload avatar"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">{profile?.name}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click the avatar to upload a new picture. JPG, PNG, GIF, or WebP, max 2MB.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.profile.personalInfo}</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.common.name}</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t.auth.email}</Label>
                  <Input value={profile?.email ?? ''} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Phone number" />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select value={formPosition} onValueChange={setFormPosition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No positions available</div>
                      )}
                      {(() => {
                        // Group by department if available, else by category
                        const hasDept = positions.some((p) => p.department)
                        if (hasDept) {
                          // Group by department
                          const groups = positions.reduce<Record<string, { dept: string; items: JobPosition[] }>>((acc, p) => {
                            const deptKey = p.department ? p.department.code : 'GENERAL'
                            if (!acc[deptKey]) acc[deptKey] = { dept: p.department ? `${p.department.code} - ${p.department.name}` : 'General', items: [] }
                            acc[deptKey].items.push(p)
                            return acc
                          }, {})
                          return Object.entries(groups).map(([key, group]) => (
                            <React.Fragment key={key}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {group.dept}
                              </div>
                              {group.items.map((p) => (
                                <SelectItem key={p.id} value={p.name}>
                                  {p.name}
                                  {p.level && <span className="ml-1.5 text-muted-foreground text-xs">({p.level})</span>}
                                </SelectItem>
                              ))}
                            </React.Fragment>
                          ))
                        }
                        // Fallback: group by category
                        const groups = positions.reduce<Record<string, JobPosition[]>>((acc, p) => {
                          const cat = p.category || 'OTHER'
                          if (!acc[cat]) acc[cat] = []
                          acc[cat].push(p)
                          return acc
                        }, {})
                        const categoryLabels: Record<string, string> = {
                          ENGINEERING: 'Engineering',
                          BUSINESS: 'Business',
                          MANAGEMENT: 'Management',
                          SUPPORT: 'Support',
                          OTHER: 'Other',
                        }
                        return Object.entries(groups).map(([cat, items]) => (
                          <React.Fragment key={cat}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {categoryLabels[cat] || cat}
                            </div>
                            {items.map((p) => (
                              <SelectItem key={p.id} value={p.name}>
                                {p.name}
                                {p.level && <span className="ml-1.5 text-muted-foreground text-xs">({p.level})</span>}
                              </SelectItem>
                            ))}
                          </React.Fragment>
                        ))
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={formTimezone} onValueChange={setFormTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.common.language}</Label>
                  <Select value={formLocale} onValueChange={setFormLocale}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                {profile?.department ? (
                  <div className="rounded-md border bg-muted/50 px-3 py-2">
                    {profile.department.parent && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                        <span className="font-mono">{profile.department.parent.code}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{profile.department.parent.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{profile.department.code}</span>
                      <span className="text-sm">{profile.department.name}</span>
                    </div>
                    {profile.department.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{profile.department.description}</p>
                    )}
                  </div>
                ) : (
                  <Input value="Not assigned" disabled className="bg-muted" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-1">
                  {profile?.roles?.map((role) => (
                    <span key={role.id} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t.profile.saveChanges}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.profile.changePassword}</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="rounded-lg border border-red-500/50 bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  type="password"
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {t.profile.changePassword}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t.profile.notificationPreferences}</CardTitle>
                  <CardDescription>Configure how you receive notifications</CardDescription>
                </div>
                <Button onClick={handleSaveNotifPrefs} disabled={savingNotifs} size="sm" className="gap-1">
                  {savingNotifs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t.common.save}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notifPrefs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No notification preferences configured. They will appear after you receive your first notification.
                </p>
              ) : (
                <div className="space-y-3">
                  {notifPrefs.map((pref) => (
                    <div key={pref.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{pref.eventKey}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <Switch
                            checked={pref.inAppEnabled}
                            onCheckedChange={() => handleToggleNotifPref(pref.eventKey, 'inAppEnabled')}
                          />
                          <span className="text-xs text-muted-foreground">In-App</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <Switch
                            checked={pref.emailEnabled}
                            onCheckedChange={() => handleToggleNotifPref(pref.eventKey, 'emailEnabled')}
                          />
                          <span className="text-xs text-muted-foreground">Email</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.common.theme}</CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{t.common.theme}</p>
                  <p className="text-xs text-muted-foreground">Toggle between light and dark mode</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {theme === 'dark' ? t.common.darkMode : t.common.lightMode}
                  </span>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
