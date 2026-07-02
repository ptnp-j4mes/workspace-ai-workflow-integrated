'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Users,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Pencil,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface Role {
  id: string
  key: string
  name: string
}

interface Department {
  id: string
  name: string
  code: string
  type: string
  parent: { id: string; name: string; code: string } | null
}

interface UserItem {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  phone: string | null
  position: string | null
  isActive: boolean
  lastLoginAt: string | null
  departmentId: string | null
  department: Department | null
  roles: Role[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================================
// Component
// ============================================================

export default function AdminUsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Add/Edit form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPosition, setFormPosition] = useState('')
  const [formDeptId, setFormDeptId] = useState('')
  const [formRoleIds, setFormRoleIds] = useState<string[]>([])

  const fetchUsers = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (search) params.set('search', search)
      if (departmentFilter !== 'all') params.set('departmentId', departmentFilter)
      if (statusFilter !== 'all') params.set('isActive', statusFilter)

      const data = await api.get<{ data: UserItem[]; pagination: Pagination }>(
        `/api/admin/users?${params.toString()}`
      )
      setUsers(data.data || [])
      setPagination(data.pagination || { page, limit: 20, total: 0, totalPages: 0 })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, departmentFilter, statusFilter])

  useEffect(() => {
    ;(() => fetchUsers(1))()
  }, [fetchUsers])

  // Fetch roles & departments on mount
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [rolesData, deptsData] = await Promise.all([
          api.get<{ data: Role[] }>('/api/admin/roles'),
          api.get<{ data: Department[] }>('/api/admin/departments'),
        ])
        setRoles(rolesData.data ?? [])
        setDepartments(deptsData.data ?? [])
      } catch {
        // Silently fail
      }
    }
    fetchMeta()
  }, [])

  const openAddDialog = () => {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormPhone('')
    setFormPosition('')
    setFormDeptId('')
    setFormRoleIds([])
    setAddDialogOpen(true)
  }

  const openEditDialog = (user: UserItem) => {
    setSelectedUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword('')
    setFormPhone(user.phone ?? '')
    setFormPosition(user.position ?? '')
    setFormDeptId(user.departmentId ?? '')
    setFormRoleIds(user.roles.map((r) => r.id))
    setEditDialogOpen(true)
  }

  const openRoleDialog = (user: UserItem) => {
    setSelectedUser(user)
    setFormRoleIds(user.roles.map((r) => r.id))
    setRoleDialogOpen(true)
  }

  const handleAddUser = async () => {
    setSaving(true)
    try {
      await api.post('/api/admin/users', {
        name: formName,
        email: formEmail,
        password: formPassword,
        phone: formPhone || undefined,
        position: formPosition || undefined,
        departmentId: formDeptId || undefined,
        roleIds: formRoleIds,
      })
      setAddDialogOpen(false)
      fetchUsers(1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/users/${selectedUser.id}`, {
        name: formName,
        phone: formPhone || null,
        position: formPosition || null,
        departmentId: formDeptId || null,
      })
      setEditDialogOpen(false)
      fetchUsers(pagination.page)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRoles = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await api.put(`/api/admin/users/${selectedUser.id}/roles`, {
        roleIds: formRoleIds,
      })
      setRoleDialogOpen(false)
      fetchUsers(pagination.page)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update roles')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: UserItem) => {
    try {
      await api.patch(`/api/admin/users/${user.id}`, {
        isActive: !user.isActive,
      })
      fetchUsers(pagination.page)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle user status')
    }
  }

  const toggleRoleInForm = (roleId: string) => {
    setFormRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    )
  }

  if (loading && users.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.users}</h1>
            <p className="text-sm text-muted-foreground">{pagination.total} {t.admin.users}</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {t.common.create} {t.admin.users}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => fetchUsers(pagination.page)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t.common.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all} {t.common.status}</SelectItem>
                <SelectItem value="true">{t.common.active}</SelectItem>
                <SelectItem value="false">{t.common.inactive}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t.admin.departments} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all} {t.admin.departments}</SelectItem>
                {(() => {
                  const divisions = departments.filter((d) => d.type === 'DIVISION')
                  const sections = departments.filter((d) => d.type === 'SECTION')
                  if (divisions.length > 0) {
                    return (
                      <>
                        {divisions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.code} — {d.name} (ฝ่าย)
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Sections</div>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.parent ? `${s.parent.code} › ` : ''}{s.code} — {s.name}
                          </SelectItem>
                        ))}
                      </>
                    )
                  }
                  return departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </SelectItem>
                  ))
                })()}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t.common.search + '...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* User Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">{t.admin.departments}</TableHead>
              <TableHead>{t.admin.roles}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="w-[120px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {user.department ? (
                      <span>
                        {user.department.parent && (
                          <span className="text-muted-foreground">{user.department.parent.code} &rsaquo; </span>
                        )}
                        <span className="font-mono text-xs">{user.department.code}</span>
                        {' '}
                        <span>{user.department.name}</span>
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role.id} variant="secondary" className="text-[10px]">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.isActive
                          ? 'text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'text-[10px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }
                    >
                      {user.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(user)}
                        title={t.common.edit}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openRoleDialog(user)}
                        title={t.admin.roles}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(user)}
                        title={user.isActive ? t.common.inactive : t.common.active}
                      >
                        {user.isActive ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchUsers(pagination.page - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> {t.common.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchUsers(pagination.page + 1)}
              className="gap-1"
            >
              {t.common.next} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.create} {t.admin.users}</DialogTitle>
            <DialogDescription>{t.common.create} {t.admin.users}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Email address" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Password" type="password" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={formPosition} onChange={(e) => setFormPosition(e.target.value)} placeholder="Job position" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formDeptId} onValueChange={setFormDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const divisions = departments.filter((d) => d.type === 'DIVISION')
                    const sections = departments.filter((d) => d.type === 'SECTION')
                    if (divisions.length > 0) {
                      return (
                        <>
                          {divisions.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.code} — {d.name} (ฝ่าย)
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Sections</div>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.parent ? `${s.parent.code} › ` : ''}{s.code} — {s.name}
                            </SelectItem>
                          ))}
                        </>
                      )
                    }
                    return departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </SelectItem>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-1.5 cursor-pointer">
                    <Switch
                      checked={formRoleIds.includes(role.id)}
                      onCheckedChange={() => toggleRoleInForm(role.id)}
                    />
                    <span className="text-sm">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleAddUser} disabled={saving || !formName || !formEmail || !formPassword}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formEmail} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={formPosition} onChange={(e) => setFormPosition(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formDeptId} onValueChange={setFormDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const divisions = departments.filter((d) => d.type === 'DIVISION')
                    const sections = departments.filter((d) => d.type === 'SECTION')
                    if (divisions.length > 0) {
                      return (
                        <>
                          {divisions.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.code} — {d.name} (ฝ่าย)
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Sections</div>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.parent ? `${s.parent.code} › ` : ''}{s.code} — {s.name}
                            </SelectItem>
                          ))}
                        </>
                      )
                    }
                    return departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </SelectItem>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleEditUser} disabled={saving || !formName}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Roles</DialogTitle>
            <DialogDescription>
              Manage roles for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/50">
                <Switch
                  checked={formRoleIds.includes(role.id)}
                  onCheckedChange={() => toggleRoleInForm(role.id)}
                />
                <div>
                  <p className="text-sm font-medium">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.key}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
