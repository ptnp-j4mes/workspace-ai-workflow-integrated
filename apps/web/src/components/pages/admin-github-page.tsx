'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  GitBranch,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface GithubConnection {
  id: string
  connectionName: string
  authType: string
  tokenEncrypted: string
  owner: string
  isActive: boolean
  lastSyncAt: string | null
  creator: { id: string; name: string; email: string }
  repositories: GithubRepo[]
}

interface GithubRepo {
  id: string
  fullName: string
  defaultBranch: string
  visibility: string
  lastSyncedAt: string | null
}

// ============================================================
// Component
// ============================================================

export default function AdminGithubPage() {
  const { t } = useI18n()
  const [connections, setConnections] = useState<GithubConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Test connection state
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formAuthType, setFormAuthType] = useState('TOKEN')
  const [formToken, setFormToken] = useState('')
  const [formOwner, setFormOwner] = useState('')

  const fetchConnections = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: GithubConnection[] }>('/api/admin/github/connections')
      setConnections(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load GitHub connections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const openAddDialog = () => {
    setFormName('')
    setFormAuthType('TOKEN')
    setFormToken('')
    setFormOwner('')
    setDialogOpen(true)
  }

  const handleAdd = async () => {
    if (!formName || !formOwner) return
    setSaving(true)
    try {
      await api.post('/api/admin/github/connections', {
        connectionName: formName,
        authType: formAuthType,
        tokenEncrypted: formToken || null,
        owner: formOwner,
      })
      setDialogOpen(false)
      fetchConnections()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add connection')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async (conn: GithubConnection) => {
    setTestingId(conn.id)
    setTestResult(null)
    try {
      const result = await api.post<{ data: { success: boolean; message: string } }>(
        `/api/admin/github/connections/${conn.id}/test`
      )
      setTestResult({ id: conn.id, success: result.data.success, message: result.data.message })
    } catch (err: unknown) {
      setTestResult({
        id: conn.id,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      })
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (conn: GithubConnection) => {
    if (!confirm('Are you sure you want to delete this connection?')) return
    try {
      await api.delete(`/api/admin/github/connections/${conn.id}`)
      fetchConnections()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection')
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48" />
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
        <Button variant="outline" onClick={fetchConnections} className="gap-2">
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900/40">
            <GitBranch className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.github}</h1>
            <p className="text-sm text-muted-foreground">{connections.length} connection(s)</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" /> {t.common.create}
        </Button>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 ${
            testResult.success
              ? 'border-green-500/50 bg-green-50 dark:bg-green-900/20'
              : 'border-red-500/50 bg-red-50 dark:bg-red-900/20'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <p className="text-sm flex-1">{testResult.message}</p>
          <Button variant="ghost" size="sm" onClick={() => setTestResult(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Connections */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.common.noData}
          </CardContent>
        </Card>
      ) : (
        connections.map((conn) => (
          <Card key={conn.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    {conn.connectionName}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Owner: {conn.owner} · Auth: {conn.authType} · Token: {conn.tokenEncrypted}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      conn.isActive
                        ? 'text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }
                  >
                    {conn.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => handleTestConnection(conn)}
                    disabled={testingId === conn.id}
                  >
                    {testingId === conn.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(conn)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {conn.repositories.length > 0 && (
              <CardContent className="pt-0">
                <h4 className="text-sm font-semibold mb-2">Synced Repositories ({conn.repositories.length})</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repository</TableHead>
                      <TableHead className="hidden md:table-cell">Branch</TableHead>
                      <TableHead className="hidden md:table-cell">Visibility</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Synced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conn.repositories.map((repo) => (
                      <TableRow key={repo.id}>
                        <TableCell className="font-mono text-sm flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {repo.fullName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{repo.defaultBranch}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-[10px]">{repo.visibility}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {repo.lastSyncedAt ? formatDate(repo.lastSyncedAt) : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
            {conn.lastSyncAt && (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Last sync: {formatDate(conn.lastSyncAt)}
                </p>
              </CardContent>
            )}
          </Card>
        ))
      )}

      {/* {t.common.create} Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.create}</DialogTitle>
            <DialogDescription>{t.common.create}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Connection Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Organization GitHub" />
            </div>
            <div className="space-y-2">
              <Label>Auth Type</Label>
              <Select value={formAuthType} onValueChange={setFormAuthType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOKEN">Personal Access Token</SelectItem>
                  <SelectItem value="GITHUB_APP">GitHub App</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Token / Secret</Label>
              <Input value={formToken} onChange={(e) => setFormToken(e.target.value)} type="password" placeholder="ghp_xxxx..." />
            </div>
            <div className="space-y-2">
              <Label>Owner / Organization *</Label>
              <Input value={formOwner} onChange={(e) => setFormOwner(e.target.value)} placeholder="e.g. my-org" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleAdd} disabled={saving || !formName || !formOwner}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
