'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Plus,
  Calendar,
  Loader2,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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

interface MaintenanceAgreement {
  id: string
  projectId: string
  type: string
  startDate: string
  endDate: string
  status: string
  slaDetails: string | null
  coverage: string | null
  createdAt: string
  updatedAt: string
  project?: {
    id: string
    name: string
    code: string
  } | null
}

const agreementStatusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  EXPIRED: { label: 'Expired', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  RENEWED: { label: 'Renewed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
}

const agreementTypeConfig: Record<string, { label: string; color: string }> = {
  STANDARD: { label: 'Standard', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  PREMIUM: { label: 'Premium', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  CUSTOM: { label: 'Custom', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' },
}

// ============================================================
// Component
// ============================================================

export default function MaintenancePage() {
  const navigate = useAppStore((s) => s.navigate)
  const { t } = useI18n()

  const [agreements, setAgreements] = useState<MaintenanceAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form
  const [formProjectId, setFormProjectId] = useState('')
  const [formType, setFormType] = useState('STANDARD')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formCoverage, setFormCoverage] = useState('')
  const [formSlaDetails, setFormSlaDetails] = useState('')

  const fetchAgreements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ agreements: MaintenanceAgreement[] }>('/api/maintenance')
      setAgreements(data.agreements || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance agreements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgreements()
  }, [fetchAgreements])

  const handleCreate = async () => {
    if (!formProjectId || !formStartDate || !formEndDate) {
      toast.warning('Validation Error', 'Project, start date, and end date are required.')
      return
    }
    setCreating(true)
    try {
      await api.post('/api/maintenance', {
        projectId: formProjectId,
        type: formType,
        startDate: formStartDate,
        endDate: formEndDate,
        coverage: formCoverage || null,
        slaDetails: formSlaDetails || null,
      })
      toast.success('Agreement created')
      setDialogOpen(false)
      setFormProjectId('')
      setFormType('STANDARD')
      setFormStartDate('')
      setFormEndDate('')
      setFormCoverage('')
      setFormSlaDetails('')
      fetchAgreements()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to create agreement')
    } finally {
      setCreating(false)
    }
  }

  const parseSlaDetails = (slaStr: string | null): Record<string, string> => {
    if (!slaStr) return {}
    try {
      return JSON.parse(slaStr)
    } catch {
      return {}
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.maintenance.title}</h1>
            <p className="text-sm text-muted-foreground">{t.maintenance.subtitle}</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Agreement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.maintenance.scheduleMaintenance}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project ID *</Label>
                  <Input value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} placeholder="Project ID" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Coverage</Label>
                <Textarea value={formCoverage} onChange={(e) => setFormCoverage(e.target.value)} rows={2} placeholder="e.g. 24/7 support, business hours only..." />
              </div>
              <div className="space-y-2">
                <Label>SLA Details (JSON)</Label>
                <Textarea
                  value={formSlaDetails}
                  onChange={(e) => setFormSlaDetails(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                  placeholder='{"responseTime": "4h", "resolutionTime": "24h", "uptime": "99.9%"}'
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t.common.create}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchAgreements} className="mt-3">{t.common.retry}</Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && agreements.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">{t.maintenance.noMaintenance}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first maintenance agreement to get started</p>
          <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Agreement
          </Button>
        </motion.div>
      )}

      {/* Agreement List */}
      {!loading && !error && agreements.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agreements.map((ag, idx) => {
            const statusConf = agreementStatusConfig[ag.status] || { label: ag.status, color: '' }
            const typeConf = agreementTypeConfig[ag.type] || { label: ag.type, color: '' }
            const slaDetails = parseSlaDetails(ag.slaDetails)
            return (
              <motion.div
                key={ag.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold">
                        {ag.project?.name || `Project ${ag.projectId.substring(0, 8)}`}
                      </CardTitle>
                      <Badge variant="secondary" className={statusConf.color}>
                        {statusConf.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={typeConf.color}>
                        {typeConf.label}
                      </Badge>
                    </div>
                    {ag.coverage && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{ag.coverage}</p>
                    )}
                    {Object.keys(slaDetails).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">{t.maintenance.affectedSystems}</span>
                        <div className="space-y-0.5">
                          {Object.entries(slaDetails).slice(0, 3).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{key}</span>
                              <span className="font-mono">{value}</span>
                            </div>
                          ))}
                          {Object.keys(slaDetails).length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{Object.keys(slaDetails).length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(ag.startDate).toLocaleDateString()} - {new Date(ag.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
