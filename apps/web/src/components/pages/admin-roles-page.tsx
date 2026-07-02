'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Check,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface Permission {
  id: string
  key: string
  name: string
  module: string
}

interface RoleItem {
  id: string
  key: string
  name: string
  description: string | null
  permissions: Permission[]
  userCount: number
}

// ============================================================
// Component
// ============================================================

export default function AdminRolesPage() {
  const { t } = useI18n()
  const { navigate } = useAppStore()
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [formKey, setFormKey] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [permSearch, setPermSearch] = useState('')

  // Delete dialog
  const [deleteRole, setDeleteRole] = useState<RoleItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchRoles = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: RoleItem[] }>('/api/admin/roles')
      setRoles(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  const fetchPermissions = async () => {
    try {
      const data = await api.get<{ data: Permission[] }>('/api/admin/permissions')
      setAllPermissions(data.data ?? [])
    } catch {
      // Ignore — permissions will be empty
    }
  }

  useEffect(() => {
    ;(() => fetchRoles())()
    ;(() => fetchPermissions())()
  }, [])

  // Group permissions by module
  const groupByModule = (permissions: Permission[]) => {
    const groups: Record<string, Permission[]> = {}
    permissions.forEach((p) => {
      if (!groups[p.module]) groups[p.module] = []
      groups[p.module].push(p)
    })
    return groups
  }

  // Open create dialog
  const handleCreate = () => {
    setEditingRole(null)
    setFormKey('')
    setFormName('')
    setFormDescription('')
    setSelectedPermIds(new Set())
    setPermSearch('')
    setDialogOpen(true)
  }

  // Open edit dialog
  const handleEdit = (role: RoleItem) => {
    setEditingRole(role)
    setFormKey(role.key)
    setFormName(role.name)
    setFormDescription(role.description || '')
    setSelectedPermIds(new Set(role.permissions.map((p) => p.id)))
    setPermSearch('')
    setDialogOpen(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!formKey.trim() || !formName.trim()) {
      toast.error('Key and name are required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        key: formKey.trim().toUpperCase().replace(/\s+/g, '_'),
        name: formName.trim(),
        description: formDescription.trim() || null,
        permissionIds: Array.from(selectedPermIds),
      }

      if (editingRole) {
        // Update
        await api.patch(`/api/admin/roles/${editingRole.id}`, payload)
        toast.success(`Role "${formName}" updated successfully`)
      } else {
        // Create
        await api.post('/api/admin/roles', payload)
        toast.success(`Role "${formName}" created successfully`)
      }

      setDialogOpen(false)
      fetchRoles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save role'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteRole) return
    setDeleting(true)
    try {
      await api.delete(`/api/admin/roles/${deleteRole.id}`)
      toast.success(`Role "${deleteRole.name}" deleted`)
      setDeleteRole(null)
      fetchRoles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete role'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  // Toggle permission selection
  const togglePermission = (permId: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) {
        next.delete(permId)
      } else {
        next.add(permId)
      }
      return next
    })
  }

  // Toggle all permissions in a module
  const toggleModule = (modulePerms: Permission[], allSelected: boolean) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev)
      modulePerms.forEach((p) => {
        if (allSelected) {
          next.delete(p.id)
        } else {
          next.add(p.id)
        }
      })
      return next
    })
  }

  // Check if a system role (non-editable key)
  const isSystemRole = (key: string) => ['ADMIN'].includes(key)

  // Filter permissions by search
  const filteredPermissions = permSearch
    ? allPermissions.filter(
        (p) =>
          p.name.toLowerCase().includes(permSearch.toLowerCase()) ||
          p.key.toLowerCase().includes(permSearch.toLowerCase()) ||
          p.module.toLowerCase().includes(permSearch.toLowerCase())
      )
    : allPermissions

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchRoles} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
            <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.roles}</h1>
            <p className="text-sm text-muted-foreground">{roles.length} roles defined</p>
          </div>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" /> {t.common.create}
        </Button>
      </div>

      {/* Roles List */}
      {roles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">{t.common.noData}</p>
            <Button onClick={handleCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> {t.common.create}
            </Button>
          </CardContent>
        </Card>
      ) : (
        roles.map((role) => {
          const isExpanded = expandedRoleId === role.id
          const permGroups = groupByModule(role.permissions)
          const systemRole = isSystemRole(role.key)
          return (
            <Card key={role.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{role.name}</CardTitle>
                        {systemRole && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Key: {role.key} · {role.permissions.length} permissions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> {role.userCount} users
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(role)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!systemRole && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteRole(role)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0">
                  {role.description && (
                    <p className="text-sm text-muted-foreground mb-4">{role.description}</p>
                  )}
                  <div className="space-y-4">
                    {Object.entries(permGroups).map(([module, perms]) => (
                      <div key={module}>
                        <h4 className="text-sm font-semibold mb-2 text-foreground">{module}</h4>
                        <div className="flex flex-wrap gap-2">
                          {perms.map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-xs">
                              {p.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                    {role.permissions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No permissions assigned.</p>
                    )}
                  </div>
                  {role.userCount > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        {role.userCount} user{role.userCount !== 1 ? 's' : ''} have this role.
                        Manage users from the{' '}
                        <button
                          className="text-primary underline"
                          onClick={() => navigate('admin-users')}
                        >
                          User Management
                        </button>{' '}
                        page.
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRole ? t.common.edit : t.common.create}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Update role details and assign permissions.'
                : 'Define a new role with permissions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
            {/* Role Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role Key</Label>
                <Input
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. PROJECT_MANAGER"
                  disabled={!!editingRole && isSystemRole(editingRole.key)}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Unique identifier (uppercase, underscore-separated)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Project Manager"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.common.description}</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description of this role"
              />
            </div>

            <Separator />

            {/* Permissions Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Permissions</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedPermIds.size} of {allPermissions.length} selected
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Search permissions..."
                  className="pl-9"
                />
              </div>

              {/* Permission groups */}
              <div className="max-h-64 overflow-y-auto space-y-3 rounded-lg border p-3">
                {Object.entries(groupByModule(filteredPermissions)).map(([module, perms]) => {
                  const allSelected = perms.every((p) => selectedPermIds.has(p.id))
                  const someSelected = perms.some((p) => selectedPermIds.has(p.id))
                  return (
                    <div key={module}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <button
                          onClick={() => toggleModule(perms, allSelected)}
                          className="flex items-center gap-2"
                        >
                          <div
                            className={`
                              flex h-4 w-4 items-center justify-center rounded border transition-colors
                              ${allSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : someSelected
                                  ? 'bg-primary/20 border-primary'
                                  : 'border-muted-foreground/40'
                              }
                            `}
                          >
                            {allSelected && <Check className="h-3 w-3" />}
                            {someSelected && !allSelected && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-foreground">{module}</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 ml-6">
                        {perms.map((p) => {
                          const isSelected = selectedPermIds.has(p.id)
                          return (
                            <button
                              key={p.id}
                              onClick={() => togglePermission(p.id)}
                              className={`
                                inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-all
                                ${isSelected
                                  ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                  : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
                                }
                              `}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                              {p.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {filteredPermissions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No permissions found.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {editingRole ? 'Update Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRole} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role{' '}
              <span className="font-semibold text-foreground">{deleteRole?.name}</span>?
              {deleteRole && deleteRole.userCount > 0 && (
                <span className="block mt-2 text-destructive">
                  This role has {deleteRole.userCount} assigned user(s). Remove users from this role
                  before deleting.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || (deleteRole ? deleteRole.userCount > 0 : false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
