'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  KeyRound,
  RefreshCw,
  Loader2,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface DocumentNumberSequence {
  id: string
  documentType: string
  prefix: string
  year: number
  currentNumber: number
  paddingLength: number
  formatTemplate: string
  resetPolicy: string
  isActive: boolean
}

// ============================================================
// Component
// ============================================================

export default function AdminDocumentNumbersPage() {
  const { t } = useI18n()
  const [sequences, setSequences] = useState<DocumentNumberSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedSeq, setSelectedSeq] = useState<DocumentNumberSequence | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState<string | null>(null)

  // Form
  const [formPrefix, setFormPrefix] = useState('')
  const [formFormat, setFormFormat] = useState('')
  const [formPadding, setFormPadding] = useState('6')
  const [formResetPolicy, setFormResetPolicy] = useState('YEARLY')

  const fetchSequences = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: DocumentNumberSequence[] }>('/api/admin/document-number-sequences')
      setSequences(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sequences')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSequences()
  }, [])

  const openEditDialog = (seq: DocumentNumberSequence) => {
    setSelectedSeq(seq)
    setFormPrefix(seq.prefix)
    setFormFormat(seq.formatTemplate)
    setFormPadding(seq.paddingLength.toString())
    setFormResetPolicy(seq.resetPolicy)
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedSeq) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/document-number-sequences/${selectedSeq.id}`, {
        prefix: formPrefix,
        formatTemplate: formFormat,
        paddingLength: parseInt(formPadding) || 6,
        resetPolicy: formResetPolicy,
      })
      setEditDialogOpen(false)
      fetchSequences()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save sequence')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (seq: DocumentNumberSequence) => {
    if (!confirm(`Reset sequence for ${seq.documentType}? Current number (${seq.currentNumber}) will be reset to 0.`)) return
    setResetting(seq.id)
    try {
      await api.post(`/api/admin/document-number-sequences/${seq.id}/reset`)
      fetchSequences()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset sequence')
    } finally {
      setResetting(null)
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
        <Button variant="outline" onClick={fetchSequences} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40">
          <KeyRound className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.documentNumbers}</h1>
          <p className="text-sm text-muted-foreground">{sequences.length} sequence(s)</p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Type</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead className="text-center">Current #</TableHead>
              <TableHead className="hidden md:table-cell">Year</TableHead>
              <TableHead className="hidden lg:table-cell">Format</TableHead>
              <TableHead className="hidden md:table-cell">Reset Policy</TableHead>
              <TableHead className="w-[120px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  {t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              sequences.map((seq) => (
                <TableRow key={seq.id}>
                  <TableCell className="font-medium">{seq.documentType}</TableCell>
                  <TableCell className="font-mono text-sm">{seq.prefix}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-mono">{seq.currentNumber}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{seq.year}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                    {seq.formatTemplate}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-[10px]">{seq.resetPolicy}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(seq)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleReset(seq)}
                        disabled={resetting === seq.id}
                      >
                        {resetting === seq.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.edit}</DialogTitle>
            <DialogDescription>
              Update format for {selectedSeq?.documentType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Prefix</Label>
              <Input value={formPrefix} onChange={(e) => setFormPrefix(e.target.value)} placeholder="AIT-REQ" />
            </div>
            <div className="space-y-2">
              <Label>Format Template</Label>
              <Input value={formFormat} onChange={(e) => setFormFormat(e.target.value)} placeholder="AIT-{PREFIX}-{YEAR}-{NUMBER}" />
              <p className="text-xs text-muted-foreground">
                Available tokens: {'{PREFIX}'}, {'{YEAR}'}, {'{NUMBER}'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Padding Length</Label>
              <Input value={formPadding} onChange={(e) => setFormPadding(e.target.value)} type="number" min={1} max={10} />
            </div>
            <div className="space-y-2">
              <Label>Reset Policy</Label>
              <Select value={formResetPolicy} onValueChange={setFormResetPolicy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="NEVER">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
