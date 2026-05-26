'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Menu,
  Plus,
  RotateCcw,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Shield,
  LayoutGrid,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { useAppStore } from '@/store/app-store'
import * as LucideIcons from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'

// ============================================================
// Types
// ============================================================

interface Role {
  id: string
  key: string
  name: string
}

interface MenuItem {
  id: string
  key: string
  label: string
  icon: string
  view: string
  parentId: string | null
  level: number
  sortOrder: number
  isVisible: boolean
  isExpanded: boolean
  requiredPermission: string | null
  badge: string | null
  badgeVariant: string | null
  children: MenuItem[]
  roles: Role[]
  createdAt: string
  updatedAt: string
}

interface DragState {
  draggedId: string | null
  draggedLevel: number
  draggedParentId: string | null
  overId: string | null
}

// ============================================================
// Icon resolver
// ============================================================

function IconPreview({ name, className }: { name: string; className?: string }) {
  const cls = className || 'h-4 w-4'
  const iconKey = name as keyof typeof LucideIcons
  const IconComponent = LucideIcons[iconKey]
  if (typeof IconComponent !== 'function') {
    return <LayoutGrid className={cls} />
  }
  return React.createElement(IconComponent, { className: cls })
}

// ============================================================
// Component
// ============================================================

export default function AdminMenusPage() {
  const { t } = useI18n()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Expanded state for lv1 items
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    draggedLevel: 1,
    draggedParentId: null,
    overId: null,
  })

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingMenu, setDeletingMenu] = useState<MenuItem | null>(null)

  // Form state
  const [formKey, setFormKey] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formIcon, setFormIcon] = useState('')
  const [formView, setFormView] = useState('')
  const [formLevel, setFormLevel] = useState(1)
  const [formParentId, setFormParentId] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsVisible, setFormIsVisible] = useState(true)
  const [formIsExpanded, setFormIsExpanded] = useState(false)
  const [formRequiredPermission, setFormRequiredPermission] = useState('')
  const [formBadge, setFormBadge] = useState('')
  const [formBadgeVariant, setFormBadgeVariant] = useState('default')
  const [formRoleIds, setFormRoleIds] = useState<string[]>([])

  // ============================================================
  // Data fetching
  // ============================================================

  const fetchMenus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: MenuItem[] }>('/api/menus')
      const menuTree = data.data ?? []
      setMenus(menuTree)
      // Auto-expand all lv1 items
      const expanded = new Set(menuTree.map((m) => m.id))
      setExpandedIds(expanded)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load menus')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const data = await api.get<{ data: Role[] }>('/api/admin/roles')
      setRoles(data.data ?? [])
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    fetchMenus()
    fetchRoles()
  }, [fetchMenus, fetchRoles])

  // ============================================================
  // Dialog helpers
  // ============================================================

  const resetForm = () => {
    setFormKey('')
    setFormLabel('')
    setFormIcon('')
    setFormView('')
    setFormLevel(1)
    setFormParentId('')
    setFormSortOrder(0)
    setFormIsVisible(true)
    setFormIsExpanded(false)
    setFormRequiredPermission('')
    setFormBadge('')
    setFormBadgeVariant('default')
    setFormRoleIds([])
  }

  const openAddDialog = () => {
    resetForm()
    setEditingMenu(null)
    setDialogOpen(true)
  }

  const openEditDialog = (menu: MenuItem) => {
    setEditingMenu(menu)
    setFormKey(menu.key)
    setFormLabel(menu.label)
    setFormIcon(menu.icon)
    setFormView(menu.view)
    setFormLevel(menu.level)
    setFormParentId(menu.parentId ?? '')
    setFormSortOrder(menu.sortOrder)
    setFormIsVisible(menu.isVisible)
    setFormIsExpanded(menu.isExpanded)
    setFormRequiredPermission(menu.requiredPermission ?? '')
    setFormBadge(menu.badge ?? '')
    setFormBadgeVariant(menu.badgeVariant ?? 'default')
    setFormRoleIds(menu.roles?.map((r) => r.id) ?? [])
    setDialogOpen(true)
  }

  const openDeleteDialog = (menu: MenuItem) => {
    setDeletingMenu(menu)
    setDeleteDialogOpen(true)
  }

  // ============================================================
  // CRUD handlers
  // ============================================================

  const handleSave = async () => {
    if (!formKey || !formLabel || !formIcon || !formView) {
      toast.error('Validation Error', 'Key, label, icon, and view are required.')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        key: formKey,
        label: formLabel,
        icon: formIcon,
        view: formView,
        level: formLevel,
        parentId: formLevel === 2 && formParentId ? formParentId : null,
        sortOrder: formSortOrder,
        isVisible: formIsVisible,
        isExpanded: formIsExpanded,
        requiredPermission: formRequiredPermission || null,
        badge: formBadge || null,
        badgeVariant: formBadgeVariant || 'default',
      }

      if (editingMenu) {
        await api.patch(`/api/menus/${editingMenu.id}`, payload)
        toast.success('Menu Updated', `"${formLabel}" has been updated.`)
      } else {
        await api.post('/api/menus', payload)
        toast.success('Menu Created', `"${formLabel}" has been created.`)
      }

      setDialogOpen(false)
      fetchMenus()
      useAppStore.getState().incrementMenuVersion()
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to save menu')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingMenu) return
    setSaving(true)
    try {
      await api.delete(`/api/menus/${deletingMenu.id}`)
      toast.success('Menu Deleted', `"${deletingMenu.label}" has been deleted.`)
      setDeleteDialogOpen(false)
      setDeletingMenu(null)
      fetchMenus()
      useAppStore.getState().incrementMenuVersion()
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to delete menu')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleVisibility = async (menu: MenuItem) => {
    try {
      await api.patch(`/api/menus/${menu.id}`, { isVisible: !menu.isVisible })
      toast.info(menu.isVisible ? 'Menu Hidden' : 'Menu Shown', `"${menu.label}" is now ${menu.isVisible ? 'hidden' : 'visible'}.`)
      fetchMenus()
      useAppStore.getState().incrementMenuVersion()
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to toggle visibility')
    }
  }

  const handleResetOrder = async () => {
    setSaving(true)
    try {
      const items: Array<{ id: string; sortOrder: number }> = []
      menus.forEach((parent, pIdx) => {
        items.push({ id: parent.id, sortOrder: pIdx })
        parent.children?.forEach((child, cIdx) => {
          items.push({ id: child.id, sortOrder: cIdx })
        })
      })
      await api.patch('/api/menus/reorder', { items })
      toast.info('Order Reset', 'Menu order has been reset sequentially.')
      fetchMenus()
      useAppStore.getState().incrementMenuVersion()
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to reset order')
    } finally {
      setSaving(false)
    }
  }

  // ============================================================
  // Drag and Drop
  // ============================================================

  const handleDragStart = (e: React.DragEvent, menu: MenuItem, parentId: string | null) => {
    // Stop propagation for lv2 items to prevent parent Card's drag handler from taking over
    if (menu.level === 2) {
      e.stopPropagation()
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', menu.id)
    setDragState({
      draggedId: menu.id,
      draggedLevel: menu.level,
      draggedParentId: parentId,
      overId: null,
    })
  }

  const handleDragOver = (e: React.DragEvent, targetId: string, targetLevel: number, targetParentId: string | null) => {
    e.preventDefault()
    // Stop propagation for lv2 items to prevent parent Card's dragOver from clearing our state
    if (targetLevel === 2) {
      e.stopPropagation()
    }
    e.dataTransfer.dropEffect = 'move'

    // Only allow drop within same level and same parent
    if (
      dragState.draggedLevel === targetLevel &&
      dragState.draggedParentId === targetParentId &&
      dragState.draggedId !== targetId
    ) {
      setDragState((prev) => ({ ...prev, overId: targetId }))
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear overId if we're actually leaving the element (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null
    const currentTarget = e.currentTarget as HTMLElement | null
    if (relatedTarget && currentTarget?.contains(relatedTarget)) {
      return
    }
    setDragState((prev) => ({ ...prev, overId: null }))
  }

  const handleDrop = async (e: React.DragEvent, targetMenu: MenuItem, targetParentId: string | null) => {
    e.preventDefault()
    // Stop propagation for lv2 items to prevent parent Card's handleDrop from firing
    if (targetMenu.level === 2) {
      e.stopPropagation()
    }
    const draggedId = dragState.draggedId
    if (!draggedId || draggedId === targetMenu.id) {
      setDragState({ draggedId: null, draggedLevel: 1, draggedParentId: null, overId: null })
      return
    }

    // Get the list to reorder
    let list: MenuItem[]
    if (targetMenu.level === 1) {
      list = [...menus]
    } else {
      const parent = menus.find((m) => m.id === targetParentId)
      list = parent?.children ? [...parent.children] : []
    }

    const draggedIdx = list.findIndex((m) => m.id === draggedId)
    const targetIdx = list.findIndex((m) => m.id === targetMenu.id)
    if (draggedIdx === -1 || targetIdx === -1) {
      setDragState({ draggedId: null, draggedLevel: 1, draggedParentId: null, overId: null })
      return
    }

    // Reorder: remove dragged, insert at target position
    const [draggedItem] = list.splice(draggedIdx, 1)
    list.splice(targetIdx, 0, draggedItem)

    // Build reorder payload
    const items = list.map((m, idx) => ({ id: m.id, sortOrder: idx }))

    try {
      await api.patch('/api/menus/reorder', { items })
      toast.success('Order Updated', 'Menu order has been updated.')
      fetchMenus()
      useAppStore.getState().incrementMenuVersion()
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to reorder menus')
    } finally {
      setDragState({ draggedId: null, draggedLevel: 1, draggedParentId: null, overId: null })
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    // Stop propagation for lv2 items to prevent parent Card's dragEnd from firing
    if (e.currentTarget instanceof HTMLElement && e.currentTarget.dataset.level === '2') {
      e.stopPropagation()
    }
    setDragState({ draggedId: null, draggedLevel: 1, draggedParentId: null, overId: null })
  }

  // ============================================================
  // Toggle expand
  // ============================================================

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ============================================================
  // Role toggle
  // ============================================================

  const toggleRoleInForm = (roleId: string) => {
    setFormRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    )
  }

  // ============================================================
  // Count helpers
  // ============================================================

  const totalMenus = menus.reduce((acc, m) => acc + 1 + (m.children?.length ?? 0), 0)
  const visibleMenus = menus.reduce(
    (acc, m) => acc + (m.isVisible ? 1 : 0) + (m.children?.filter((c) => c.isVisible).length ?? 0),
    0
  )
  const hiddenMenus = totalMenus - visibleMenus

  // ============================================================
  // Loading state
  // ============================================================

  if (loading && menus.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ============================================================
  // Error state
  // ============================================================

  if (error && menus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchMenus} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Menu className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.menus}</h1>
            <p className="text-sm text-muted-foreground">{t.admin.menus}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleResetOrder} disabled={saving} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t.common.refresh}
          </Button>
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.common.create}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <LayoutGrid className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.common.total}</p>
              <p className="text-xl font-bold">{totalMenus}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <Eye className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visible</p>
              <p className="text-xl font-bold">{visibleMenus}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/40">
              <EyeOff className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hidden</p>
              <p className="text-xl font-bold">{hiddenMenus}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Menu Tree */}
      {menus.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Menu className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">{t.common.noData} &quot;{t.common.create}&quot; to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {menus.map((parentMenu) => {
              const isExpanded = expandedIds.has(parentMenu.id)
              const isDragging = dragState.draggedId === parentMenu.id
              const isOver = dragState.overId === parentMenu.id

              return (
                <motion.div
                  key={parentMenu.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Card
                    className={`transition-all ${
                      isDragging
                        ? 'opacity-50 ring-2 ring-amber-400'
                        : isOver
                        ? 'ring-2 ring-amber-300'
                        : ''
                    }`}
                    data-level="1"
                    draggable
                    onDragStart={(e) => handleDragStart(e, parentMenu, null)}
                    onDragOver={(e) => handleDragOver(e, parentMenu.id, 1, null)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, parentMenu, null)}
                    onDragEnd={handleDragEnd}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        {/* Drag handle */}
                        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>

                        {/* Expand toggle */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleExpand(parentMenu.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Icon preview */}
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-muted">
                          <IconPreview name={parentMenu.icon} className="h-4 w-4 text-foreground" />
                        </div>

                        {/* Label & Key */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{parentMenu.label}</span>
                            {parentMenu.badge && (
                              <Badge
                                variant={
                                  parentMenu.badgeVariant === 'destructive'
                                    ? 'destructive'
                                    : parentMenu.badgeVariant === 'secondary'
                                    ? 'secondary'
                                    : parentMenu.badgeVariant === 'outline'
                                    ? 'outline'
                                    : 'default'
                                }
                                className="text-[10px] px-1.5 py-0"
                              >
                                {parentMenu.badge}
                              </Badge>
                            )}
                            <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded hidden sm:inline">
                              {parentMenu.key}
                            </code>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              View: {parentMenu.view}
                            </span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">
                              Order: {parentMenu.sortOrder}
                            </span>
                          </div>
                        </div>

                        {/* Permissions */}
                        <div className="hidden md:flex items-center gap-1 flex-wrap">
                          {parentMenu.roles?.slice(0, 3).map((role) => (
                            <Badge key={role.id} variant="outline" className="text-[10px] px-1.5 py-0">
                              <Shield className="h-2.5 w-2.5 mr-0.5" />
                              {role.name}
                            </Badge>
                          ))}
                          {parentMenu.roles?.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{parentMenu.roles.length - 3}
                            </Badge>
                          )}
                          {(!parentMenu.roles || parentMenu.roles.length === 0) && (
                            <span className="text-[10px] text-muted-foreground italic">No roles</span>
                          )}
                        </div>

                        {/* Required Permission */}
                        {parentMenu.requiredPermission && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden lg:inline-flex">
                            {parentMenu.requiredPermission}
                          </Badge>
                        )}

                        {/* Visibility toggle */}
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={parentMenu.isVisible}
                            onCheckedChange={() => handleToggleVisibility(parentMenu)}
                            className="scale-75"
                          />
                          <span className="text-[10px] text-muted-foreground w-12">
                            {parentMenu.isVisible ? 'Visible' : 'Hidden'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(parentMenu)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(parentMenu)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Children count badge when collapsed */}
                      {!isExpanded && parentMenu.children?.length > 0 && (
                        <div className="mt-1 ml-10">
                          <span className="text-[10px] text-muted-foreground">
                            {parentMenu.children.length} sub-item{parentMenu.children.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </CardContent>

                    {/* Children */}
                    <AnimatePresence>
                      {isExpanded && parentMenu.children?.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3">
                            <Separator className="mb-2" />
                            <div className="ml-6 space-y-1">
                              {parentMenu.children.map((childMenu) => {
                                const isChildDragging = dragState.draggedId === childMenu.id
                                const isChildOver = dragState.overId === childMenu.id

                                return (
                                  <motion.div
                                    key={childMenu.id}
                                    layout
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 8 }}
                                    transition={{ duration: 0.1 }}
                                    data-level="2"
                                    className={`flex items-center gap-2 rounded-lg border p-2 transition-all cursor-default ${
                                      isChildDragging
                                        ? 'opacity-50 ring-2 ring-amber-400'
                                        : isChildOver
                                        ? 'ring-2 ring-amber-300 bg-amber-50/50 dark:bg-amber-900/10'
                                        : 'hover:bg-muted/50'
                                    }`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, childMenu, parentMenu.id)}
                                    onDragOver={(e) => handleDragOver(e, childMenu.id, 2, parentMenu.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, childMenu, parentMenu.id)}
                                    onDragEnd={handleDragEnd}
                                  >
                                    {/* Drag handle */}
                                    <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                                      <GripVertical className="h-3.5 w-3.5" />
                                    </div>

                                    {/* Icon */}
                                    <div className="flex h-6 w-6 items-center justify-center rounded bg-muted/70">
                                      <IconPreview name={childMenu.icon} className="h-3.5 w-3.5 text-foreground" />
                                    </div>

                                    {/* Label & Key */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm truncate">{childMenu.label}</span>
                                        {childMenu.badge && (
                                          <Badge
                                            variant={
                                              childMenu.badgeVariant === 'destructive'
                                                ? 'destructive'
                                                : childMenu.badgeVariant === 'secondary'
                                                ? 'secondary'
                                                : childMenu.badgeVariant === 'outline'
                                                ? 'outline'
                                                : 'default'
                                            }
                                            className="text-[9px] px-1 py-0"
                                          >
                                            {childMenu.badge}
                                          </Badge>
                                        )}
                                        <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded hidden sm:inline">
                                          {childMenu.key}
                                        </code>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">
                                        View: {childMenu.view} · Order: {childMenu.sortOrder}
                                      </span>
                                    </div>

                                    {/* Permissions */}
                                    <div className="hidden md:flex items-center gap-1">
                                      {childMenu.roles?.slice(0, 2).map((role) => (
                                        <Badge key={role.id} variant="outline" className="text-[9px] px-1 py-0">
                                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                                          {role.name}
                                        </Badge>
                                      ))}
                                      {childMenu.roles?.length > 2 && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                                          +{childMenu.roles.length - 2}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Required Permission */}
                                    {childMenu.requiredPermission && (
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 hidden lg:inline-flex">
                                        {childMenu.requiredPermission}
                                      </Badge>
                                    )}

                                    {/* Visibility */}
                                    <Switch
                                      checked={childMenu.isVisible}
                                      onCheckedChange={() => handleToggleVisibility(childMenu)}
                                      className="scale-70"
                                    />

                                    {/* Actions */}
                                    <div className="flex items-center gap-0.5">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => openEditDialog(childMenu)}
                                        title="Edit"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                        onClick={() => openDeleteDialog(childMenu)}
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </motion.div>
                                )
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Drag hint */}
      {menus.length > 1 && (
        <p className="text-xs text-muted-foreground text-center">
          💡 Drag and drop items to reorder within the same level. Use the grip handle on the left.
        </p>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMenu ? '{t.common.edit}' : '{t.common.create}'}</DialogTitle>
            <DialogDescription>
              {editingMenu ? '{t.common.edit}' : '{t.common.create}'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key *</Label>
                <Input
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. dashboard"
                />
              </div>
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Dashboard"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="e.g. LayoutDashboard"
                  />
                  {formIcon && (
                    <div className="flex h-9 w-9 items-center justify-center rounded border bg-muted shrink-0">
                      <IconPreview name={formIcon} className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>View *</Label>
                <Input
                  value={formView}
                  onChange={(e) => setFormView(e.target.value)}
                  placeholder="e.g. dashboard"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Level</Label>
                <Select
                  value={String(formLevel)}
                  onValueChange={(val) => {
                    setFormLevel(Number(val))
                    if (Number(val) === 1) setFormParentId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 (Top-level)</SelectItem>
                    <SelectItem value="2">Level 2 (Sub-item)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formLevel === 2 && (
                <div className="space-y-2">
                  <Label>Parent Menu</Label>
                  <Select value={formParentId} onValueChange={setFormParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {menus.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formLevel === 1 && <div />}
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Required Permission</Label>
                <Input
                  value={formRequiredPermission}
                  onChange={(e) => setFormRequiredPermission(e.target.value)}
                  placeholder="e.g. admin (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label>Badge Text</Label>
                <Input
                  value={formBadge}
                  onChange={(e) => setFormBadge(e.target.value)}
                  placeholder="e.g. New (optional)"
                />
              </div>
            </div>

            {formBadge && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Badge Variant</Label>
                  <Select value={formBadgeVariant} onValueChange={setFormBadgeVariant}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t.common.all}</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                      <SelectItem value="destructive">Destructive</SelectItem>
                      <SelectItem value="outline">Outline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Preview:</span>
                    <Badge
                      variant={
                        formBadgeVariant === 'destructive'
                          ? 'destructive'
                          : formBadgeVariant === 'secondary'
                          ? 'secondary'
                          : formBadgeVariant === 'outline'
                          ? 'outline'
                          : 'default'
                      }
                    >
                      {formBadge}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={formIsVisible} onCheckedChange={setFormIsVisible} />
                <Label>Visible</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formIsExpanded} onCheckedChange={setFormIsExpanded} />
                <Label>Expanded</Label>
              </div>
            </div>

            <Separator />

            {/* Role Permissions */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role Permissions
              </Label>
              <p className="text-xs text-muted-foreground">
                Select which roles can see this menu. Leave empty for all authenticated users.
              </p>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                      formRoleIds.includes(role.id)
                        ? 'bg-primary/10 border-primary/30'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Switch
                      checked={formRoleIds.includes(role.id)}
                      onCheckedChange={() => toggleRoleInForm(role.id)}
                      className="scale-75"
                    />
                    <span className="text-sm">{role.name}</span>
                    <code className="text-[10px] text-muted-foreground">{role.key}</code>
                  </label>
                ))}
              </div>
              {roles.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No roles available.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formKey || !formLabel || !formIcon || !formView}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMenu ? 'Save Changes' : 'Create Menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{deletingMenu?.label}&quot;</strong>?
              {deletingMenu?.children && deletingMenu.children.length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This will also delete {deletingMenu.children.length} sub-item
                  {deletingMenu.children.length !== 1 ? 's' : ''}.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
