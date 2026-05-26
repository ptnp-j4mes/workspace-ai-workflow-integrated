'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  Building2,
  Plus,
  RefreshCw,
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Users,
  Briefcase,
  FolderTree,
  Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
import { toast } from '@/lib/toast'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface DepartmentChild {
  id: string
  name: string
  code: string
  type: string
  description: string | null
  parentId: string | null
  sortOrder: number
  isActive: boolean
  userCount: number
}

interface Department {
  id: string
  name: string
  code: string
  type: string
  description: string | null
  parentId: string | null
  sortOrder: number
  isActive: boolean
  parent: { id: string; name: string; code: string } | null
  userCount: number
  childCount: number
  jobPositionCount: number
  children: DepartmentChild[]
  createdAt: string
  updatedAt: string
}

// ============================================================
// Component
// ============================================================

export default function AdminDepartmentsPage() {
  const { t } = useI18n()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedDept, setSelectedDept] = useState<Department | DepartmentChild | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set())

  // Form
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formType, setFormType] = useState('SECTION')
  const [formDescription, setFormDescription] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  // Get divisions (top-level) and sections
  const divisions = departments.filter((d) => d.type === 'DIVISION')

  const fetchDepartments = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: Department[] }>('/api/admin/departments')
      setDepartments(data.data ?? [])
      // Auto-expand all divisions
      const divIds = (data.data ?? [])
        .filter((d: Department) => d.type === 'DIVISION')
        .map((d: Department) => d.id)
      setExpandedDivisions(new Set(divIds))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  const toggleDivision = (id: string) => {
    setExpandedDivisions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openAddDivisionDialog = () => {
    setEditMode(false)
    setSelectedDept(null)
    setFormName('')
    setFormCode('')
    setFormType('DIVISION')
    setFormDescription('')
    setFormParentId('')
    setFormSortOrder(0)
    setFormIsActive(true)
    setDialogOpen(true)
  }

  const openAddSectionDialog = (divisionId?: string) => {
    setEditMode(false)
    setSelectedDept(null)
    setFormName('')
    setFormCode('')
    setFormType('SECTION')
    setFormDescription('')
    setFormParentId(divisionId || '')
    setFormSortOrder(0)
    setFormIsActive(true)
    setDialogOpen(true)
  }

  const openEditDialog = (dept: Department | DepartmentChild) => {
    setEditMode(true)
    setSelectedDept(dept)
    setFormName(dept.name)
    setFormCode(dept.code)
    setFormType(dept.type)
    setFormDescription(dept.description ?? '')
    setFormParentId(dept.parentId ?? '')
    setFormSortOrder(dept.sortOrder ?? 0)
    setFormIsActive(dept.isActive ?? true)
    setDialogOpen(true)
  }

  const openDeleteDialog = (dept: Department | DepartmentChild) => {
    setSelectedDept(dept)
    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !formCode) {
      toast.warning('Validation', 'Name and code are required')
      return
    }
    if (formType === 'SECTION' && !formParentId) {
      toast.warning('Validation', 'Section must belong to a Division')
      return
    }
    setSaving(true)
    try {
      if (editMode && selectedDept) {
        await api.patch(`/api/admin/departments`, {
          id: selectedDept.id,
          name: formName,
          code: formCode,
          type: formType,
          description: formDescription || null,
          parentId: formParentId || null,
          sortOrder: formSortOrder,
          isActive: formIsActive,
        })
        toast.success('Updated', `${formName} has been updated`)
      } else {
        await api.post('/api/admin/departments', {
          name: formName,
          code: formCode,
          type: formType,
          description: formDescription || null,
          parentId: formParentId || null,
          sortOrder: formSortOrder,
        })
        toast.success('Created', `${formName} has been created`)
      }
      setDialogOpen(false)
      fetchDepartments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save department'
      toast.error('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedDept) return
    setSaving(true)
    try {
      await api.delete(`/api/admin/departments?id=${selectedDept.id}`)
      toast.success('Deleted', `${selectedDept.name} has been deleted`)
      setDeleteDialogOpen(false)
      fetchDepartments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department'
      toast.error('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchDepartments} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.departments}</h1>
            <p className="text-sm text-muted-foreground">
              {divisions.length} divisions · {departments.filter((d) => d.type === 'SECTION').length} sections
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAddDivisionDialog} className="gap-2">
            <Layers className="h-4 w-4" /> {t.common.create}
          </Button>
          <Button variant="outline" onClick={() => openAddSectionDialog()} className="gap-2">
            <FolderTree className="h-4 w-4" /> {t.common.create}
          </Button>
        </div>
      </div>

      {/* Division > Section Hierarchy */}
      {divisions.length === 0 ? (
        <Card className="py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t.common.noData}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Create a Division first, then add Sections under it.
              </p>
            </div>
            <Button onClick={openAddDivisionDialog} className="gap-2 mt-2">
              <Layers className="h-4 w-4" /> {t.common.create}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {divisions.map((division) => {
            const isExpanded = expandedDivisions.has(division.id)
            const sections = division.children ?? []
            const totalUsers = division.userCount + sections.reduce((sum, s) => sum + s.userCount, 0)

            return (
              <Card key={division.id} className="overflow-hidden">
                {/* Division Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleDivision(division.id)}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                    <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded">
                        {division.code}
                      </span>
                      <span className="font-semibold text-foreground">{division.name}</span>
                      {division.description && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {division.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {totalUsers} users
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderTree className="h-3 w-3" /> {sections.length} sections
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> {division.jobPositionCount} positions
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!division.isActive && (
                      <Badge variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500">{t.common.inactive}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); openEditDialog(division) }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); openDeleteDialog(division) }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Section List (expandable) */}
                {isExpanded && (
                  <div className="border-t">
                    {sections.length === 0 ? (
                      <div className="flex items-center justify-between px-4 py-6 text-sm text-muted-foreground">
                        <span>{t.common.noData}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openAddSectionDialog(division.id)}
                        >
                          <Plus className="h-3 w-3" /> {t.common.create}
                        </Button>
                      </div>
                    ) : (
                      <>
                        {sections.map((section) => (
                          <div
                            key={section.id}
                            className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                          >
                            <div className="w-6 flex justify-center">
                              <div className="h-6 w-px bg-border" />
                            </div>
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-50 dark:bg-amber-900/30">
                              <FolderTree className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                                  {section.code}
                                </span>
                                <span className="text-sm font-medium text-foreground">{section.name}</span>
                                {section.description && (
                                  <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {section.description}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" /> {section.userCount} users
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!section.isActive && (
                                <Badge variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 mr-1">{t.common.inactive}</Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditDialog(section)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => openDeleteDialog(section)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="px-4 py-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs text-muted-foreground"
                            onClick={() => openAddSectionDialog(division.id)}
                          >
                            <Plus className="h-3 w-3" /> Add section to {division.code}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editMode ? '{t.common.edit}' : '{t.common.create}'}</DialogTitle>
            <DialogDescription>
              {editMode ? '{t.common.edit}' : '{t.common.create}'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={formType} onValueChange={(v) => {
                setFormType(v)
                if (v === 'DIVISION') setFormParentId('')
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIVISION">
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-violet-500" />
                      Division (ฝ่าย)
                    </span>
                  </SelectItem>
                  <SelectItem value="SECTION">
                    <span className="flex items-center gap-2">
                      <FolderTree className="h-3.5 w-3.5 text-amber-500" />
                      Section (แผนก)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} placeholder="e.g. SD, BA, IT" />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Department name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.common.description}</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="e.g. SD-ฝ่ายวิเคราะห์และพัฒนาซอฟต์แวร์" />
            </div>
            {formType === 'SECTION' && (
              <div className="space-y-2">
                <Label>Parent Division *</Label>
                <Select value={formParentId} onValueChange={setFormParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions
                      .filter((d) => d.id !== (selectedDept as Department)?.id)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} - {d.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)} />
              </div>
              {editMode && (
                <div className="space-y-2 flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                    <span className="text-sm">{t.common.active}</span>
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !formName || !formCode || (formType === 'SECTION' && !formParentId)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editMode ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.common.delete}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedDept?.name}</strong> ({selectedDept?.code})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
