'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Search,
  FolderKanban,
  Users,
  FileText,
  Calendar,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { useI18n } from '@/i18n'

// ============================================================
// Types
// ============================================================

interface Project {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  startDate: string | null
  endDate: string | null
  currentVersion: number
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
    email: string
  }
  _count: {
    members: number
    requests: number
  }
}

// ============================================================
// Status badge helper
// ============================================================

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  let className = ''

  if (s === 'ACTIVE') {
    className = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  } else if (s === 'ON_HOLD') {
    className = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  } else if (s === 'COMPLETED') {
    className = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  } else if (s === 'ARCHIVED') {
    className = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  } else {
    className = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  return (
    <Badge variant="secondary" className={`text-xs ${className}`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

// ============================================================
// Component
// ============================================================

export default function ProjectsPage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await api.get<{ projects: Project[] }>(`/api/projects${query}`)
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    fetchProjects()
  }, [fetchProjects])

  // Create project
  const handleCreateProject = async () => {
    if (!formName.trim()) return

    setCreating(true)
    try {
      const data = await api.post<{ project: Project }>('/api/projects', {
        code: formCode.trim() || undefined,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        startDate: formStartDate || undefined,
        endDate: formEndDate || undefined,
      })

      setProjects((prev) => [data.project, ...prev])
      setDialogOpen(false)
      resetForm()
    } catch (error: any) {
      console.error('Failed to create project:', error)
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormCode('')
    setFormName('')
    setFormDescription('')
    setFormStartDate('')
    setFormEndDate('')
  }

  // Filter projects by search
  const filteredProjects = React.useMemo(() => {
    if (!searchTerm.trim()) return projects
    const term = searchTerm.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term))
    )
  }, [projects, searchTerm])

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.projects.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.projects.subtitle}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t.projects.createProject}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t.projects.createProject}</DialogTitle>
              <DialogDescription>
                {t.projects.subtitle}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="project-code">Project Code</Label>
                <Input
                  id="project-code"
                  placeholder="e.g. AIT2605-001 (auto-generated if empty)"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-name">{t.common.name} *</Label>
                <Input
                  id="project-name"
                  placeholder="e.g. Digital Transformation Initiative"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-description">{t.common.description}</Label>
                <Textarea
                  id="project-description"
                  placeholder="Brief description of the project..."
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start-date">{t.projects.startDate}</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end-date">{t.projects.endDate}</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}
              >
                {t.common.cancel}
              </Button>
              <Button
                onClick={handleCreateProject}
                                disabled={creating || !formName.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  t.projects.createProject
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search / Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.projects.searchProjects}
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={`${t.common.all} ${t.common.status}es`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all} {t.common.status}es</SelectItem>
            <SelectItem value="ACTIVE">{t.common.active}</SelectItem>
            <SelectItem value="ON_HOLD">{t.common.onHold}</SelectItem>
            <SelectItem value="COMPLETED">{t.common.completed}</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FolderKanban className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-foreground">{t.projects.noProjectsFound}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : t.projects.createProject}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => navigate('project-detail', { id: project.id })}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {project.code}
                      </span>
                      <StatusBadge status={project.status} />
                      <Badge variant="outline" className="text-[10px]">v{project.currentVersion ?? 1}</Badge>
                    </div>
                    <CardTitle className="text-base truncate">{project.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-2 mb-4 min-h-[2.5rem]">
                  {project.description || t.common.noData}
                </CardDescription>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{project._count.members} {t.projects.members.toLowerCase()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{project._count.requests} {t.requests.title.toLowerCase()}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(project.startDate)} — {formatDate(project.endDate)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
