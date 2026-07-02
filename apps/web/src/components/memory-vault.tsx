'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  FolderOpen,
  FolderClosed,
  FileText,
  Puzzle,
  ClipboardList,
  CalendarDays,
  LayoutTemplate,
  Paintbrush,
  Plus,
  Trash2,
  Pencil,
  Search,
  RefreshCw,
  Loader2,
  ChevronRight,
  ChevronDown,
  Eye,
  Edit3,
  Pin,
  Link2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  ArrowRight,
  X,
  Check,
  Network,
  BookOpen,
  Terminal,
  Braces,
  Upload,
  Paperclip,
  Image,
  File,
  Download,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface VaultNode {
  id: string
  projectId: string
  parentId: string | null
  name: string
  type: 'NOTE' | 'FOLDER' | 'SOLUTION' | 'INDEX' | 'DAILY_NOTE' | 'TEMPLATE' | 'CANVAS'
  content: string | null
  frontmatter: string | null
  tags: string | null
  sortOrder: number
  isPinned: boolean
  isExpanded: boolean
  icon: string | null
  color: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  outgoing?: VaultLink[]
  incoming?: VaultLink[]
  children?: VaultNode[]
}

interface VaultLink {
  id: string
  sourceId: string
  targetId: string
  label: string | null
  linkType: 'REFERENCE' | 'DEPENDS_ON' | 'RELATED' | 'DERIVED_FROM' | 'IMPLEMENTS'
  createdAt: string
  source?: VaultNode
  target?: VaultNode
}

interface VaultAttachment {
  id: string
  nodeId: string | null
  projectId: string
  fileName: string
  originalName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  storageType: string
  uploadedById: string | null
  createdAt: string
}

interface MemoryVaultProps {
  projectId: string
}

// ============================================================
// Node type config
// ============================================================

const NODE_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  NOTE: { icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Note' },
  FOLDER: { icon: FolderOpen, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Folder' },
  SOLUTION: { icon: Puzzle, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Solution' },
  INDEX: { icon: ClipboardList, color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'Index' },
  DAILY_NOTE: { icon: CalendarDays, color: 'text-pink-400', bg: 'bg-pink-500/10', label: 'Daily Note' },
  TEMPLATE: { icon: LayoutTemplate, color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Template' },
  CANVAS: { icon: Paintbrush, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Canvas' },
  UPLOAD: { icon: Upload, color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: 'Upload' },
}

// Graph node color mapping (fill colors for SVG)
const NODE_TYPE_COLORS: Record<string, string> = {
  NOTE: '#34d399',       // emerald-400
  FOLDER: '#fbbf24',     // amber-400
  SOLUTION: '#c084fc',   // purple-400
  INDEX: '#38bdf8',      // sky-400
  DAILY_NOTE: '#f472b6', // pink-400
  TEMPLATE: '#8b5cf6',   // violet-400
  CANVAS: '#fb923c',     // orange-400
  UPLOAD: '#22d3ee',     // cyan-400
}

// ============================================================
// Utility: Build tree from flat list
// ============================================================

function buildTree(nodes: VaultNode[]): VaultNode[] {
  const map = new Map<string, VaultNode>()
  const roots: VaultNode[] = []

  nodes.forEach(n => map.set(n.id, { ...n, children: [] }))

  nodes.forEach(n => {
    const node = map.get(n.id)!
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  // Sort by sortOrder
  const sortChildren = (items: VaultNode[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder)
    items.forEach(item => {
      if (item.children && item.children.length > 0) {
        sortChildren(item.children)
      }
    })
  }
  sortChildren(roots)

  return roots
}

// ============================================================
// Utility: Time ago
// ============================================================

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ============================================================
// Utility: Parse wiki-links [[...]]
// ============================================================

function renderContentWithWikiLinks(
  content: string,
  onWikiLinkClick: (name: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\[\[([^\]]+)\]\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    const linkName = match[1]
    parts.push(
      <button
        key={`wl-${match.index}`}
        onClick={(e) => { e.stopPropagation(); onWikiLinkClick(linkName) }}
        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 decoration-emerald-500/40 hover:decoration-emerald-400 transition-colors font-mono text-sm cursor-pointer"
      >
        {linkName}
      </button>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

// ============================================================
// Sub-component: File Explorer Tree Item
// ============================================================

function TreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onAddChild,
  onRename,
  onDelete,
  searchQuery,
}: {
  node: VaultNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (node: VaultNode) => void
  onToggle: (id: string) => void
  onAddChild: (parentId: string, type: 'NOTE' | 'FOLDER') => void
  onRename: (node: VaultNode) => void
  onDelete: (node: VaultNode) => void
  searchQuery: string
}) {
  const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.NOTE
  const Icon = config.icon
  const isSelected = selectedId === node.id
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children && node.children.length > 0
  const [hovered, setHovered] = useState(false)

  // Filter children by search
  const filteredChildren = useMemo(() => {
    if (!searchQuery.trim()) return node.children || []
    const q = searchQuery.toLowerCase()
    const matchesSelf = node.name.toLowerCase().includes(q)
    const matchingChildren = (node.children || []).filter(child =>
      child.name.toLowerCase().includes(q) || hasMatchingDescendants(child, q)
    )
    return matchesSelf ? (node.children || []) : matchingChildren
  }, [node.children, node.name, searchQuery])

  if (filteredChildren.length === 0 && searchQuery.trim() && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
    return null
  }

  return (
    <div>
      <div
        className={`
          group flex items-center gap-1 px-2 py-1 rounded text-xs font-mono cursor-pointer
          transition-colors relative
          ${isSelected
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(node)
          if (hasChildren) onToggle(node.id)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Connecting line */}
        {depth > 0 && (
          <div
            className="absolute top-0 bottom-0 border-l border-border/30"
            style={{ left: `${(depth - 1) * 16 + 14}px` }}
          />
        )}

        {/* Expand/collapse chevron */}
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon */}
        {node.type === 'FOLDER' ? (
          isExpanded ? (
            <FolderOpen className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
          ) : (
            <FolderClosed className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
          )
        ) : (
          <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
        )}

        {/* Name */}
        <span className="truncate flex-1">{node.name}</span>

        {/* Pinned indicator */}
        {node.isPinned && (
          <Pin className="h-2.5 w-2.5 text-amber-400/60 shrink-0" />
        )}

        {/* Hover actions */}
        {hovered && (
          <div className="flex items-center gap-0.5 ml-auto shrink-0">
            {node.type === 'FOLDER' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddChild(node.id, 'NOTE') }}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent size="sm">Add note</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRename(node) }}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent size="sm">Rename</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(node) }}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent size="sm">Delete</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && filteredChildren.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggle={onToggle}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  )
}

function hasMatchingDescendants(node: VaultNode, query: string): boolean {
  if (node.name.toLowerCase().includes(query)) return true
  if (node.children) {
    return node.children.some(child => hasMatchingDescendants(child, query))
  }
  return false
}

// ============================================================
// Sub-component: Graph View
// ============================================================

interface GraphNode {
  id: string
  name: string
  type: string
  x: number
  y: number
  vx: number
  vy: number
  connections: number
}

interface GraphEdge {
  source: string
  target: string
  label: string | null
  linkType: string
}

function ForceGraph({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: VaultNode[]
  links: VaultLink[]
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
}) {
  const { t } = useI18n()
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const width = 800
  const height = 500

  // Build graph data from vault data
  const graphData = useMemo(() => {
    const gNodes: GraphNode[] = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length
      const radius = Math.min(width, height) * 0.3
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        x: width / 2 + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: height / 2 + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        connections: 0,
      }
    })

    const gEdges: GraphEdge[] = links.map(l => ({
      source: l.sourceId,
      target: l.targetId,
      label: l.label,
      linkType: l.linkType,
    }))

    // Count connections
    const connCount = new Map<string, number>()
    gEdges.forEach(e => {
      connCount.set(e.source, (connCount.get(e.source) || 0) + 1)
      connCount.set(e.target, (connCount.get(e.target) || 0) + 1)
    })
    gNodes.forEach(n => {
      n.connections = connCount.get(n.id) || 0
    })

    return { gNodes, gEdges }
  }, [nodes, links])

  // Run force simulation
  useEffect(() => {
    const gNodes = graphData.gNodes.map(n => ({ ...n }))
    const gEdges = graphData.gEdges

    const nodeMap = new Map(gNodes.map(n => [n.id, n]))

    // Simple force simulation iterations
    for (let iter = 0; iter < 120; iter++) {
      // Repulsion between all pairs
      for (let i = 0; i < gNodes.length; i++) {
        for (let j = i + 1; j < gNodes.length; j++) {
          const a = gNodes[i]
          const b = gNodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 800 / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx -= fx
          a.vy -= fy
          b.vx += fx
          b.vy += fy
        }
      }

      // Attraction along edges
      gEdges.forEach(e => {
        const source = nodeMap.get(e.source)
        const target = nodeMap.get(e.target)
        if (!source || !target) return
        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = dist * 0.02
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        source.vx += fx
        source.vy += fy
        target.vx -= fx
        target.vy -= fy
      })

      // Center gravity
      gNodes.forEach(n => {
        n.vx += (width / 2 - n.x) * 0.005
        n.vy += (height / 2 - n.y) * 0.005
      })

      // Apply velocity with damping
      const damping = 0.85
      gNodes.forEach(n => {
        n.vx *= damping
        n.vy *= damping
        n.x += n.vx
        n.y += n.vy
        // Keep within bounds
        n.x = Math.max(30, Math.min(width - 30, n.x))
        n.y = Math.max(30, Math.min(height - 30, n.y))
      })
    }

    ;(() => setGraphNodes(gNodes))()
  }, [graphData])

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3))
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3))
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // Mouse panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      setPanStart({ ...pan })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: panStart.x + (e.clientX - dragStart.x),
      y: panStart.y + (e.clientY - dragStart.y),
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const nodeMap = useMemo(() => new Map(graphNodes.map(n => [n.id, n])), [graphNodes])

  // Selected node details
  const selectedGraph = useMemo(() => {
    if (!selectedNodeId) return null
    return graphNodes.find(n => n.id === selectedNodeId) || null
  }, [selectedNodeId, graphNodes])

  const selectedVaultNode = useMemo(() => {
    if (!selectedNodeId) return null
    return nodes.find(n => n.id === selectedNodeId) || null
  }, [selectedNodeId, nodes])

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <Network className="h-12 w-12 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground font-mono">
          <span className="text-emerald-500">$</span> No nodes to visualize
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full min-h-[500px]">
      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden bg-slate-950/50 rounded-l-lg border border-border/50">
        {/* Controls */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7 bg-slate-900/80 border-border/50" onClick={handleZoomIn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 bg-slate-900/80 border-border/50" onClick={handleZoomOut}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 bg-slate-900/80 border-border/50" onClick={handleReset}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 rounded-lg border border-border/50 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-1.5">Legend</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] font-mono text-muted-foreground">{type.replace('_', ' ').toLowerCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`translate(${pan.x / zoom}, ${pan.y / zoom}) scale(${zoom})`}>
            {/* Edges */}
            {graphData.gEdges.map((edge, i) => {
              const source = nodeMap.get(edge.source)
              const target = nodeMap.get(edge.target)
              if (!source || !target) return null
              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="rgba(148,163,184,0.2)"
                    strokeWidth={1}
                  />
                  {/* Arrow */}
                  <circle
                    cx={target.x - (target.x - source.x) * 0.12}
                    cy={target.y - (target.y - source.y) * 0.12}
                    r={2}
                    fill="rgba(148,163,184,0.3)"
                  />
                </g>
              )
            })}

            {/* Nodes */}
            {graphNodes.map(gn => {
              const nodeColor = NODE_TYPE_COLORS[gn.type] || NODE_TYPE_COLORS.NOTE
              const radius = Math.max(6, 6 + gn.connections * 2)
              const isSelected = selectedNodeId === gn.id
              return (
                <g
                  key={gn.id}
                  transform={`translate(${gn.x}, ${gn.y})`}
                  onClick={() => onSelectNode(gn.id)}
                  className="cursor-pointer"
                >
                  {/* Glow for selected */}
                  {isSelected && (
                    <circle r={radius + 6} fill="none" stroke={nodeColor} strokeWidth={2} opacity={0.4} />
                  )}
                  {/* Node circle */}
                  <circle
                    r={radius}
                    fill={nodeColor}
                    opacity={isSelected ? 1 : 0.75}
                    className="transition-opacity hover:opacity-100"
                  />
                  {/* Label */}
                  <text
                    y={radius + 12}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px] font-mono select-none"
                  >
                    {gn.name.length > 14 ? gn.name.slice(0, 12) + '…' : gn.name}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Zoom indicator */}
        <div className="absolute bottom-3 right-3 z-10 bg-slate-900/90 rounded-md border border-border/50 px-2 py-1">
          <span className="text-[10px] font-mono text-muted-foreground">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Side panel for selected node */}
      {selectedGraph && selectedVaultNode && (
        <div className="w-64 border-l border-border/50 bg-muted/10 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <Badge className={`${NODE_TYPE_CONFIG[selectedVaultNode.type]?.bg || ''} ${NODE_TYPE_CONFIG[selectedVaultNode.type]?.color || ''} border-0 text-[10px] font-mono`}>
              {selectedVaultNode.type.replace('_', ' ')}
            </Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSelectNode('')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <h3 className="text-sm font-semibold font-mono text-foreground mb-2">{selectedVaultNode.name}</h3>
          <Separator className="my-3 bg-border/30" />
          <div className="space-y-2 text-xs font-mono text-muted-foreground">
            <div className="flex justify-between">
              <span>Connections</span>
              <span className="text-foreground">{selectedGraph.connections}</span>
            </div>
            <div className="flex justify-between">
              <span>Pinned</span>
              <span className="text-foreground">{selectedVaultNode.isPinned ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="text-foreground">{timeAgo(selectedVaultNode.updatedAt)}</span>
            </div>
          </div>
          {selectedVaultNode.tags && (
            <>
              <Separator className="my-3 bg-border/30" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1">
                {(JSON.parse(selectedVaultNode.tags) as string[]).map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">{tag}</Badge>
                ))}
              </div>
            </>
          )}
          {selectedVaultNode.content && (
            <>
              <Separator className="my-3 bg-border/30" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-1.5">Preview</p>
              <p className="text-xs font-mono text-muted-foreground/80 line-clamp-4 whitespace-pre-wrap">
                {selectedVaultNode.content.slice(0, 200)}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-component: Solution Generator
// ============================================================

function SolutionGenerator({
  projectId,
  onGenerated,
}: {
  projectId: string
  onGenerated: () => void
}) {
  const { t } = useI18n()
  const [requirements, setRequirements] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedStructure, setGeneratedStructure] = useState<VaultNode[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!requirements.trim()) return
    setGenerating(true)
    setError(null)
    setGeneratedStructure(null)
    try {
      const data = await api.post<{ data: VaultNode[] }>(
        `/api/projects/${projectId}/vault/generate`,
        { requirements }
      )
      setGeneratedStructure(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate vault structure')
    } finally {
      setGenerating(false)
    }
  }

  const handleApply = async () => {
    if (!generatedStructure) return
    setApplying(true)
    try {
      // Create each node via API
      for (const node of generatedStructure) {
        await api.post(`/api/projects/${projectId}/vault`, {
          name: node.name,
          type: node.type,
          parentId: node.parentId,
          content: node.content,
        })
      }
      setGeneratedStructure(null)
      setRequirements('')
      onGenerated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply structure')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Sparkles className="h-5 w-5 text-purple-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold font-mono text-foreground">Solution Generator</h2>
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-purple-500">$</span> AI-powered vault structure generation
          </p>
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* Requirements input */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Requirements
        </label>
        <Textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder="Describe your project requirements, knowledge domains, and desired structure... e.g., 'Build a knowledge base for a microservices e-commerce platform with API docs, architecture decisions, and runbooks'"
          className="min-h-[180px] font-mono text-sm bg-slate-950/50 border-border/50 resize-none"
        />
        <Button
          onClick={handleGenerate}
          disabled={generating || !requirements.trim()}
          className="gap-2 font-mono"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Vault Structure
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm font-mono text-red-400">
            <span className="text-red-500">$</span> error: {error}
          </p>
        </Card>
      )}

      {/* Loading skeleton */}
      {generating && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            <span className="text-xs font-mono text-muted-foreground">Generating vault structure...</span>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Generated structure preview */}
      {generatedStructure && generatedStructure.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold font-mono text-foreground">
              Generated Structure
              <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0 font-mono">
                {generatedStructure.length} nodes
              </Badge>
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGeneratedStructure(null)}
              className="h-7 gap-1.5 font-mono text-xs"
            >
              <X className="h-3 w-3" />
              Discard
            </Button>
          </div>

          <Card className="overflow-hidden border-border/50 bg-slate-950/30">
            <div className="px-3 py-2 border-b border-border/50 bg-muted/30 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <span className="text-xs font-mono text-muted-foreground">preview.json</span>
            </div>
            <ScrollArea className="max-h-64">
              <pre className="p-4 text-xs font-mono leading-relaxed">
                <code>
                  <span className="text-muted-foreground/50">{'// Generated vault structure\n'}</span>
                  <span className="text-amber-400">{'['}</span>{'\n'}
                  {generatedStructure.map((node, idx) => {
                    const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.NOTE
                    const isLast = idx === generatedStructure.length - 1
                    return (
                      <React.Fragment key={node.id || idx}>
                        {'  '}
                        <span className="text-sky-300">{'{'}</span>{'\n'}
                        {'    '}
                        <span className="text-emerald-400">name</span>
                        <span className="text-muted-foreground">: </span>
                        <span className="text-amber-300">&quot;{node.name}&quot;</span>{'\n'}
                        {'    '}
                        <span className="text-emerald-400">type</span>
                        <span className="text-muted-foreground">: </span>
                        <span className={config.color}>&quot;{node.type}&quot;</span>{'\n'}
                        {'  '}
                        <span className="text-sky-300">{'}'}</span>
                        {!isLast && <span className="text-muted-foreground">,</span>}
                        {'\n'}
                      </React.Fragment>
                    )
                  })}
                  <span className="text-amber-400">{']'}</span>
                </code>
              </pre>
            </ScrollArea>
          </Card>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleApply}
              disabled={applying}
              className="gap-2 font-mono"
            >
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply Structure
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setGeneratedStructure(null)}
              disabled={applying}
              className="font-mono"
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Component: MemoryVault
// ============================================================

export default function MemoryVault({ projectId }: MemoryVaultProps) {
  const { t } = useI18n()

  // Core data
  const [nodes, setNodes] = useState<VaultNode[]>([])
  const [links, setLinks] = useState<VaultLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // View state
  const [activeView, setActiveView] = useState<'tree' | 'graph' | 'generator'>('tree')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')

  // Dialog state
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false)
  const [addNodeType, setAddNodeType] = useState<'NOTE' | 'FOLDER'>('NOTE')
  const [addNodeParentId, setAddNodeParentId] = useState<string | null>(null)
  const [addNodeName, setAddNodeName] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renamingNode, setRenamingNode] = useState<VaultNode | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingNode, setDeletingNode] = useState<VaultNode | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Upload state
  const [attachments, setAttachments] = useState<VaultAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nodesRes, linksRes] = await Promise.allSettled([
        api.get<{ data: VaultNode[] }>(`/api/projects/${projectId}/vault`),
        api.get<{ data: VaultLink[] }>(`/api/projects/${projectId}/vault/links`),
      ])
      if (nodesRes.status === 'fulfilled') {
        setNodes(nodesRes.value.data ?? [])
      }
      if (linksRes.status === 'fulfilled') {
        setLinks(linksRes.value.data ?? [])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load vault data')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Fetch attachments
  const fetchAttachments = useCallback(async () => {
    try {
      const data = await api.get<{ data: VaultAttachment[] }>(`/api/projects/${projectId}/vault/upload`)
      setAttachments(data.data ?? [])
    } catch {
      // Silently fail
    }
  }, [projectId])

  useEffect(() => {
    ;(() => fetchData())()
    ;(() => fetchAttachments())()
  }, [fetchData, fetchAttachments])

  // Build tree
  const tree = useMemo(() => buildTree(nodes), [nodes])

  // Selected node
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return nodes.find(n => n.id === selectedNodeId) || null
  }, [selectedNodeId, nodes])

  // Pinned nodes
  const pinnedNodes = useMemo(() => nodes.filter(n => n.isPinned && n.type !== 'FOLDER'), [nodes])

  // Stats
  const nodeCount = nodes.length
  const linkCount = links.length
  const lastUpdated = useMemo(() => {
    if (nodes.length === 0) return null
    const sorted = [...nodes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return sorted[0].updatedAt
  }, [nodes])

  // Toggle expand
  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Select node
  const handleSelectNode = useCallback((node: VaultNode) => {
    if (node.type !== 'FOLDER') {
      setSelectedNodeId(node.id)
      setEditMode(false)
      setEditContent(node.content || '')
    }
  }, [])

  // Wiki-link click
  const handleWikiLinkClick = useCallback((name: string) => {
    const found = nodes.find(n => n.name.toLowerCase() === name.toLowerCase())
    if (found) {
      setSelectedNodeId(found.id)
      setEditMode(false)
      setEditContent(found.content || '')
    }
  }, [nodes])

  // Add node
  const handleAddChild = useCallback((parentId: string, type: 'NOTE' | 'FOLDER') => {
    setAddNodeParentId(parentId)
    setAddNodeType(type)
    setAddNodeName('')
    setAddNodeDialogOpen(true)
  }, [])

  const handleAddTopLevel = useCallback((type: 'NOTE' | 'FOLDER') => {
    setAddNodeParentId(null)
    setAddNodeType(type)
    setAddNodeName('')
    setAddNodeDialogOpen(true)
  }, [])

  const handleAddNodeSubmit = async () => {
    if (!addNodeName.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/api/projects/${projectId}/vault`, {
        name: addNodeName,
        type: addNodeType,
        parentId: addNodeParentId,
        content: addNodeType === 'NOTE' ? `# ${addNodeName}\n\n` : null,
      })
      setAddNodeDialogOpen(false)
      setAddNodeName('')
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setSubmitting(false)
    }
  }

  // Rename node
  const handleRename = useCallback((node: VaultNode) => {
    setRenamingNode(node)
    setRenameValue(node.name)
    setRenameDialogOpen(true)
  }, [])

  const handleRenameSubmit = async () => {
    if (!renamingNode || !renameValue.trim()) return
    setSubmitting(true)
    try {
      await api.patch(`/api/projects/${projectId}/vault`, {
        id: renamingNode.id,
        name: renameValue,
      })
      setRenameDialogOpen(false)
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename node')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete node
  const handleDelete = useCallback((node: VaultNode) => {
    setDeletingNode(node)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteSubmit = async () => {
    if (!deletingNode) return
    setSubmitting(true)
    try {
      await api.delete(`/api/projects/${projectId}/vault`, { id: deletingNode.id })
      setDeleteDialogOpen(false)
      if (selectedNodeId === deletingNode.id) {
        setSelectedNodeId(null)
      }
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
    } finally {
      setSubmitting(false)
    }
  }

  // Save content
  const handleSaveContent = async () => {
    if (!selectedNodeId) return
    setSubmitting(true)
    try {
      await api.patch(`/api/projects/${projectId}/vault`, {
        id: selectedNodeId,
        content: editContent,
      })
      setEditMode(false)
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save content')
    } finally {
      setSubmitting(false)
    }
  }

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        if (selectedNodeId) {
          formData.append('nodeId', selectedNodeId)
        }
        const token = localStorage.getItem('eawp_access_token') || ''
        await fetch(`/api/projects/${projectId}/vault/upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      }
      // Refresh attachments
      await fetchAttachments()
      // Refresh nodes if we appended to a node's content
      if (selectedNodeId) {
        await fetchData()
      }
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }, [projectId, selectedNodeId, fetchAttachments, fetchData])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Get file icon based on mimeType
  const getFileIcon = (mimeType: string): React.ElementType => {
    if (mimeType.startsWith('image/')) return Image
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet')) return File
    return Paperclip
  }

  // Node-specific attachments
  const nodeAttachments = useMemo(() => {
    if (!selectedNodeId) return []
    return attachments.filter(a => a.nodeId === selectedNodeId)
  }, [selectedNodeId, attachments])

  // Parse frontmatter
  const parsedFrontmatter = useMemo(() => {
    if (!selectedNode?.frontmatter) return null
    try {
      return JSON.parse(selectedNode.frontmatter)
    } catch {
      return null
    }
  }, [selectedNode])

  // Parse tags
  const parsedTags = useMemo(() => {
    if (!selectedNode?.tags) return []
    try {
      return JSON.parse(selectedNode.tags) as string[]
    } catch {
      return []
    }
  }, [selectedNode])

  // Backlinks
  const backlinks = useMemo(() => {
    if (!selectedNodeId) return []
    return links.filter(l => l.targetId === selectedNodeId)
  }, [selectedNodeId, links])

  // ============================================================
  // Loading state
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-0 rounded-lg overflow-hidden border border-border/50">
          <div className="w-56 shrink-0 border-r border-border/50 bg-muted/20 p-3 space-y-2">
            <Skeleton className="h-6 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
          <div className="flex-1 p-6 space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Error state
  // ============================================================

  if (error && nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
          <Terminal className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-mono text-red-400">$ error: {error}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">exit code: 1</p>
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2 font-mono text-sm">
          <RefreshCw className="h-4 w-4" /> $ retry
        </Button>
      </div>
    )
  }

  // ============================================================
  // Main render
  // ============================================================

  return (
    <div className="space-y-0">
      {/* Header with tabs */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <BookOpen className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              Memory Vault
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              <span className="text-emerald-500">$</span> obsidian --open vault:{projectId.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg border border-border/50 p-1">
          <button
            onClick={() => setActiveView('tree')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors
              ${activeView === 'tree'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            <Braces className="h-3.5 w-3.5" />
            Tree View
          </button>
          <button
            onClick={() => setActiveView('graph')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors
              ${activeView === 'graph'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            <Network className="h-3.5 w-3.5" />
            Graph View
          </button>
          <button
            onClick={() => setActiveView('generator')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors
              ${activeView === 'generator'
                ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generator
          </button>
        </div>
      </div>

      {/* Main content area */}
      {activeView === 'tree' && (
        <div className="flex gap-0 rounded-lg overflow-hidden border border-border/50 shadow-sm">
          {/* ===== Left sidebar: File Explorer ===== */}
          <div className="w-56 shrink-0 border-r border-border/50 bg-muted/20 flex flex-col">
            {/* Sidebar header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Explorer
              </span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono ml-auto">
                {nodeCount}
              </Badge>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddTopLevel('NOTE')}
                className="h-6 gap-1 font-mono text-[10px] flex-1"
              >
                <Plus className="h-3 w-3" />
                Note
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddTopLevel('FOLDER')}
                className="h-6 gap-1 font-mono text-[10px] flex-1"
              >
                <Plus className="h-3 w-3" />
                Folder
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadDialogOpen(true)}
                      className="h-6 gap-1 font-mono text-[10px] flex-1"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Upload
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent size="sm">Upload files to vault</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Search */}
            <div className="px-2 py-1.5 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter..."
                  className="h-6 pl-6 pr-1 text-[10px] font-mono bg-background border-border/50"
                />
              </div>
            </div>

            {/* Tree */}
            <ScrollArea className="flex-1 max-h-[calc(100vh-380px)]">
              <div className="px-1 py-1">
                {tree.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground/20" />
                    <p className="text-[10px] font-mono text-muted-foreground">Empty vault</p>
                  </div>
                ) : (
                  tree.map(node => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      selectedId={selectedNodeId}
                      expandedIds={expandedIds}
                      onSelect={handleSelectNode}
                      onToggle={handleToggle}
                      onAddChild={handleAddChild}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      searchQuery={searchQuery}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ===== Right content area ===== */}
          <div
            className="flex-1 min-w-0 bg-background flex flex-col relative"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation(); setDragOver(false);
              if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files)
              }
            }}
          >
            {/* Drop overlay */}
            {dragOver && (
              <div className="absolute inset-0 z-50 bg-cyan-500/10 border-2 border-dashed border-cyan-500/50 rounded-lg flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/20 border border-cyan-500/30">
                  <Upload className="h-8 w-8 text-cyan-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-mono text-cyan-400 font-semibold">Drop files here</p>
                  <p className="text-xs font-mono text-cyan-400/60 mt-1">
                    {selectedNodeId ? 'Files will be attached to current note' : 'Files will be added to vault root'}
                  </p>
                </div>
              </div>
            )}
            {/* Editor title bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/30">
              {/* Traffic light dots */}
              <div className="flex items-center gap-1.5 mr-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>

              {selectedNode ? (
                <>
                  {/* Active file tab */}
                  <div className="flex items-center gap-1.5 bg-background border border-border/50 rounded-t px-3 py-1 text-xs font-mono text-foreground -mb-[1px]">
                    {(() => {
                      const cfg = NODE_TYPE_CONFIG[selectedNode.type] || NODE_TYPE_CONFIG.NOTE
                      const Ic = cfg.icon
                      return <Ic className={`h-3 w-3 ${cfg.color}`} />
                    })()}
                    <span>{selectedNode.name}</span>
                  </div>

                  {/* Edit/View toggle */}
                  <div className="ml-auto flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={editMode ? 'outline' : 'ghost'}
                            size="icon"
                            className={`h-7 w-7 ${editMode ? 'border-emerald-500/50 text-emerald-500' : ''}`}
                            onClick={() => {
                              if (editMode) {
                                setEditMode(false)
                              } else {
                                setEditContent(selectedNode.content || '')
                                setEditMode(true)
                              }
                            }}
                          >
                            {editMode ? <Eye className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{editMode ? 'View mode' : 'Edit mode'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {editMode && (
                      <Button
                        size="sm"
                        onClick={handleSaveContent}
                        disabled={submitting}
                        className="h-7 gap-1 font-mono text-xs"
                      >
                        {submitting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Save
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-xs font-mono text-muted-foreground">vault-overview.md</span>
              )}
            </div>

            {/* Content area */}
            <ScrollArea className="flex-1 max-h-[calc(100vh-420px)]">
              {selectedNode ? (
                <div className="p-4 space-y-4">
                  {/* Frontmatter */}
                  {parsedFrontmatter && (
                    <div className="rounded-md bg-slate-950/60 border border-border/30 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-2">Frontmatter</p>
                      <pre className="text-xs font-mono text-amber-300 leading-relaxed">
                        {'---\n'}{JSON.stringify(parsedFrontmatter, null, 2)}{'\n---'}
                      </pre>
                    </div>
                  )}

                  {/* Tags */}
                  {parsedTags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {parsedTags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5 font-mono bg-emerald-500/10 text-emerald-400 border-0">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Content */}
                  {editMode ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[300px] font-mono text-sm bg-slate-950/60 border-border/30 resize-none leading-relaxed"
                      placeholder="Write your markdown content here..."
                    />
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none font-mono leading-relaxed whitespace-pre-wrap break-words">
                      {selectedNode.content ? (
                        renderContentWithWikiLinks(selectedNode.content, handleWikiLinkClick)
                      ) : (
                        <p className="text-muted-foreground/50 italic text-sm">No content yet. Click edit to start writing.</p>
                      )}
                    </div>
                  )}

                  {/* Backlinks */}
                  {backlinks.length > 0 && (
                    <div className="mt-6 border-t border-border/30 pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
                        <Link2 className="h-3 w-3" />
                        Backlinks ({backlinks.length})
                      </p>
                      <div className="space-y-1">
                        {backlinks.map(bl => {
                          const sourceNode = nodes.find(n => n.id === bl.sourceId)
                          if (!sourceNode) return null
                          return (
                            <button
                              key={bl.id}
                              onClick={() => handleSelectNode(sourceNode)}
                              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs font-mono text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                            >
                              <ArrowRight className="h-3 w-3 text-emerald-500/60" />
                              <span>{sourceNode.name}</span>
                              {bl.linkType && (
                                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono ml-auto">
                                  {bl.linkType}
                                </Badge>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {nodeAttachments.length > 0 && (
                    <div className="mt-6 border-t border-border/30 pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
                        <Paperclip className="h-3 w-3" />
                        Attachments ({nodeAttachments.length})
                      </p>
                      <div className="space-y-1.5">
                        {nodeAttachments.map(attachment => {
                          const FileIcon = getFileIcon(attachment.mimeType)
                          return (
                            <div
                              key={attachment.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors group"
                            >
                              <FileIcon className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                              <span className="text-xs font-mono text-foreground truncate flex-1">{attachment.originalName}</span>
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{formatFileSize(attachment.fileSize)}</span>
                              <a
                                href={attachment.fileUrl}
                                download={attachment.originalName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="h-3 w-3" />
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Vault Overview */
                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold font-mono text-foreground flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-emerald-500" />
                      Vault Overview
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      <span className="text-emerald-500">$</span> Select a note from the explorer to view its content
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/30 border border-border/30 p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-foreground">{nodeCount}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Nodes</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 border border-border/30 p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-foreground">{linkCount}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Links</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 border border-border/30 p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-foreground">
                        {nodes.filter(n => n.type === 'FOLDER').length}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">Folders</p>
                    </div>
                  </div>

                  {/* Pinned notes */}
                  {pinnedNodes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
                        <Pin className="h-3 w-3" />
                        Pinned Notes
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pinnedNodes.slice(0, 6).map(node => {
                          const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.NOTE
                          const Icon = config.icon
                          return (
                            <button
                              key={node.id}
                              onClick={() => handleSelectNode(node)}
                              className="flex items-center gap-2 p-2.5 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                            >
                              <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-mono font-medium text-foreground truncate">{node.name}</p>
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  {node.content ? node.content.slice(0, 50) + '...' : 'Empty note'}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Type breakdown */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-2">Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => {
                        const count = nodes.filter(n => n.type === type).length
                        if (count === 0) return null
                        const Icon = config.icon
                        return (
                          <Badge key={type} variant="secondary" className={`text-[10px] px-2 py-1 font-mono ${config.bg} ${config.color} border-0`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {count} {config.label}{count > 1 ? 's' : ''}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Status bar */}
            <div className="flex items-center gap-3 px-3 py-1 border-t border-border/50 bg-muted/30 text-[10px] font-mono text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Ready</span>
              </div>
              <span className="text-muted-foreground/30">|</span>
              <span>{nodeCount} nodes</span>
              <span className="text-muted-foreground/30">|</span>
              <span>{linkCount} links</span>
              <span className="text-muted-foreground/30">|</span>
              <span>{selectedNode ? selectedNode.type.replace('_', ' ').toLowerCase() : 'overview'}</span>
              {lastUpdated && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span>Last edited {timeAgo(lastUpdated)}</span>
                </>
              )}
              {editMode && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="text-emerald-400">editing</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Graph View ===== */}
      {activeView === 'graph' && (
        <div className="rounded-lg overflow-hidden border border-border/50 shadow-sm">
          <ForceGraph
            nodes={nodes}
            links={links}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => {
              setSelectedNodeId(id || null)
            }}
          />
          {/* Status bar */}
          <div className="flex items-center gap-3 px-3 py-1 border-t border-border/50 bg-muted/30 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Graph</span>
            </div>
            <span className="text-muted-foreground/30">|</span>
            <span>{nodeCount} nodes</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{linkCount} edges</span>
            <span className="text-muted-foreground/30">|</span>
            <span>Force-directed layout</span>
            {selectedNodeId && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-emerald-400">selected: {nodes.find(n => n.id === selectedNodeId)?.name}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Solution Generator ===== */}
      {activeView === 'generator' && (
        <div className="rounded-lg overflow-hidden border border-border/50 shadow-sm bg-background">
          <SolutionGenerator projectId={projectId} onGenerated={fetchData} />
          {/* Status bar */}
          <div className="flex items-center gap-3 px-3 py-1 border-t border-border/50 bg-muted/30 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span>AI Generator</span>
            </div>
            <span className="text-muted-foreground/30">|</span>
            <span>Powered by z-ai-web-dev-sdk</span>
          </div>
        </div>
      )}

      {/* ===== Add Node Dialog ===== */}
      <Dialog open={addNodeDialogOpen} onOpenChange={setAddNodeDialogOpen}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono">
              Add {addNodeType === 'NOTE' ? 'Note' : 'Folder'}
            </DialogTitle>
            <DialogDescription className="font-mono">
              Create a new {addNodeType.toLowerCase()} in the vault
              {addNodeParentId && (
                <span> under &quot;{nodes.find(n => n.id === addNodeParentId)?.name}&quot;</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={addNodeName}
            onChange={(e) => setAddNodeName(e.target.value)}
            placeholder={addNodeType === 'NOTE' ? 'Note name' : 'Folder name'}
            className="font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addNodeName.trim()) handleAddNodeSubmit()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNodeDialogOpen(false)} className="font-mono">
              Cancel
            </Button>
            <Button onClick={handleAddNodeSubmit} disabled={!addNodeName.trim() || submitting} className="font-mono">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Rename Dialog ===== */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono">Rename</DialogTitle>
            <DialogDescription className="font-mono">
              Enter a new name for &quot;{renamingNode?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="New name"
            className="font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) handleRenameSubmit()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} className="font-mono">
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={!renameValue.trim() || submitting} className="font-mono">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Dialog ===== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono">Delete &quot;{deletingNode?.name}&quot;?</DialogTitle>
            <DialogDescription className="font-mono">
              This action cannot be undone. All child notes and links will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="font-mono">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSubmit}
              disabled={submitting}
              className="font-mono"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Upload Dialog ===== */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan-400" />
              Upload Files
            </DialogTitle>
            <DialogDescription className="font-mono">
              {selectedNodeId
                ? <>Files will be attached to &quot;{selectedNode?.name}&quot;</>
                : 'Files will be added to the vault root'
              }
            </DialogDescription>
          </DialogHeader>
          <div
            className="border-2 border-dashed border-border/50 rounded-lg p-8 flex flex-col items-center justify-center gap-3 bg-slate-950/30 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files)
                setUploadDialogOpen(false)
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Upload className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-mono text-foreground">Drag & drop files here</p>
              <p className="text-xs font-mono text-muted-foreground mt-1">or click to browse</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files)
                setUploadDialogOpen(false)
                // Reset input
                e.target.value = ''
              }
            }}
          />
          {uploading && (
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Uploading...</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="font-mono">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
