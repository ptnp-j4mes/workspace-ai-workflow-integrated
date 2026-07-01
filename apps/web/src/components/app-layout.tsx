'use client'

import React, { useEffect, useState, lazy, Suspense, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  ClipboardList,
  Video,
  TestTube2,
  Bug,
  Shield,
  Sparkles,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Inbox,
  GitPullRequest,
  Settings,
  Users,
  Building,
  CheckSquare,
  Mail,
  FileCode,
  ScrollText,
  Github,
  Bot,
  Hash,
  FileSearch,
  Clock,
  Search,
  Loader2,
  BarChart3,
  Activity,
  CalendarDays,
  Menu as MenuIcon,
  RefreshCw,
  Cloud,
  Monitor,
  FolderOpen,
  FolderCheck,
  Ticket,
  AlertTriangle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import type { TranslationKeys } from '@/i18n'
import { LanguageSwitcher } from '@/components/language-switcher'
import { api } from '@/lib/api-client'

// ============================================================
// Dynamic page loader
// ============================================================

const PAGE_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  'dashboard': () => import('@/components/pages/dashboard-page'),
  'projects': () => import('@/components/pages/projects-page'),
  'project-detail': () => import('@/components/pages/project-detail-page'),
  'requests': () => import('@/components/pages/requests-page'),
  'request-create': () => import('@/components/pages/request-create-page'),
  'request-detail': () => import('@/components/pages/request-detail-page'),
  'work-items': () => import('@/components/pages/work-items-page'),
  'meetings': () => import('@/components/pages/meetings-page'),
  'meeting-detail': () => import('@/components/pages/meeting-detail-page'),
  'uat': () => import('@/components/pages/uat-page'),
  'bugs': () => import('@/components/pages/bugs-page'),
  'prompts': () => import('@/components/pages/prompts-page'),
  'prompt-detail': () => import('@/components/pages/prompt-detail-page'),
  'maintenance': () => import('@/components/pages/maintenance-page'),
  'notifications': () => import('@/components/pages/notifications-page'),
  'ai-intake': () => import('@/components/pages/ai-intake-page'),
  'admin': () => import('@/components/pages/admin-page'),
  'admin-users': () => import('@/components/pages/admin-users-page'),
  'admin-roles': () => import('@/components/pages/admin-roles-page'),
  'admin-departments': () => import('@/components/pages/admin-departments-page'),
  'admin-approval-workflows': () => import('@/components/pages/admin-approval-workflows-page'),
  'admin-notification-rules': () => import('@/components/pages/admin-notification-rules-page'),
  'admin-smtp': () => import('@/components/pages/admin-smtp-page'),
  'admin-email-templates': () => import('@/components/pages/admin-email-templates-page'),
  'admin-email-logs': () => import('@/components/pages/admin-email-logs-page'),
  'admin-github': () => import('@/components/pages/admin-github-page'),
  'admin-ai-settings': () => import('@/components/pages/admin-ai-settings-page'),
  'admin-prompt-studio': () => import('@/components/pages/prompts-page'),
  'admin-document-numbers': () => import('@/components/pages/admin-document-numbers-page'),
  'admin-system-settings': () => import('@/components/pages/admin-system-settings-page'),
  'admin-audit-logs': () => import('@/components/pages/admin-audit-logs-page'),
  'admin-jobs': () => import('@/components/pages/admin-jobs-page'),
  'admin-github-logs': () => import('@/components/pages/admin-github-page'),
  'admin-menus': () => import('@/components/pages/admin-menus-page'),
  'profile': () => import('@/components/pages/profile-page'),
  'action-inbox': () => import('@/components/pages/action-inbox-page'),
  'change-requests': () => import('@/components/pages/change-requests-page'),
  'reports': () => import('@/components/pages/report-page'),
  'activity-daily': () => import('@/components/pages/activity-daily-page'),
  'calendar': () => import('@/components/pages/calendar-page'),
  'admin-google-settings': () => import('@/components/pages/admin-google-settings-page'),
  'platform-request': () => import('@/components/pages/platform-request-page'),
  'platform-request-create': () => import('@/components/pages/platform-request-create-page'),
  'platform-request-detail': () => import('@/components/pages/platform-request-detail-page'),
}

// ============================================================
// Icon mapping
// ============================================================

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  FolderKanban,
  FileText,
  ClipboardList,
  Video,
  TestTube2,
  Bug,
  Shield,
  Sparkles,
  Inbox,
  GitPullRequest,
  Settings,
  Users,
  Building,
  CheckSquare,
  Mail,
  FileCode,
  ScrollText,
  Github,
  Bot,
  Hash,
  FileSearch,
  Clock,
  BarChart3,
  Activity,
  CalendarDays,
  Menu: MenuIcon,
  Bell,
  Cloud,
  Monitor,
  FolderCheck,
}

function getIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || LayoutDashboard
}

// ============================================================
// Menu types (from API)
// ============================================================

interface MenuChild {
  id: string
  key: string
  label: string
  icon: string
  view: string
  level: number
  sortOrder: number
  isVisible: boolean
  isExpanded: boolean
  requiredPermission: string | null
  badge: string | null
  badgeVariant: string | null
  parentId?: string
}

interface MenuParent {
  id: string
  key: string
  label: string
  icon: string
  view: string
  level: number
  sortOrder: number
  isVisible: boolean
  isExpanded: boolean
  requiredPermission: string | null
  badge: string | null
  badgeVariant: string | null
  children: MenuChild[]
}

// ============================================================
// Search result types
// ============================================================

interface SearchResult {
  type: string
  id: string
  title: string
  description?: string
  aitNo?: string | null
  status?: string
  code?: string
}

const SEARCH_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; view: string; color: string }> = {
  DOCUMENT_NUMBER: { label: 'Document', icon: FileSearch, view: 'action-inbox', color: 'text-violet-500' },
  REQUEST: { label: 'Request', icon: Ticket, view: 'request-detail', color: 'text-amber-500' },
  PROJECT: { label: 'Project', icon: FolderOpen, view: 'project-detail', color: 'text-emerald-500' },
  WORK_ITEM: { label: 'Work Item', icon: ClipboardList, view: 'work-items', color: 'text-sky-500' },
  BUG: { label: 'Bug', icon: AlertTriangle, view: 'bugs', color: 'text-red-500' },
}

// ============================================================
// Breadcrumb helper
// ============================================================

function getBreadcrumbItems(view: string, _params: Record<string, string>, menus: MenuParent[], t: TranslationKeys) {
  const items: Array<{ label: string; view?: string; params?: Record<string, string> }> = []

  // Build a label lookup from the dynamic menu data + translations
  const viewLabels: Record<string, string> = {
    dashboard: t.breadcrumbs.dashboard,
    projects: t.breadcrumbs.projects,
    'project-detail': t.breadcrumbs.projectDetail,
    requests: t.breadcrumbs.requests,
    'request-detail': t.breadcrumbs.requestDetail,
    'request-create': t.breadcrumbs.createRequest,
    'work-items': t.breadcrumbs.workItems,
    meetings: t.breadcrumbs.meetings,
    'meeting-detail': t.breadcrumbs.meetingDetail,
    uat: t.breadcrumbs.uat,
    bugs: t.breadcrumbs.bugs,
    'bug-detail': t.breadcrumbs.bugDetail,
    prompts: t.breadcrumbs.prompts,
    'prompt-detail': t.breadcrumbs.promptDetail,
    'prompt-editor': t.breadcrumbs.promptEditor,
    maintenance: t.breadcrumbs.maintenance,
    notifications: t.breadcrumbs.notifications,
    'ai-intake': t.breadcrumbs.aiIntake,
    admin: t.breadcrumbs.adminDashboard,
    profile: t.breadcrumbs.profile,
    'action-inbox': t.breadcrumbs.actionInbox,
    'change-requests': t.breadcrumbs.changeRequests,
    reports: t.breadcrumbs.reports,
    'activity-daily': t.breadcrumbs.activityDaily,
    calendar: t.breadcrumbs.calendar,
    'admin-google-settings': t.admin.googleSettings,
    'platform-request': t.breadcrumbs.platformRequests,
    'platform-request-create': t.breadcrumbs.requestNewPlatform,
    'platform-request-detail': t.breadcrumbs.platformRequestDetail,
    'my-projects': t.projects.myProjects,
    'admin-users': t.admin.users,
    'admin-roles': t.admin.roles,
    'admin-departments': t.admin.departments,
    'admin-approval-workflows': t.admin.approvalWorkflows,
    'admin-notification-rules': t.admin.notificationRules,
    'admin-smtp': t.admin.smtp,
    'admin-email-templates': t.admin.emailTemplates,
    'admin-email-logs': t.admin.emailLogs,
    'admin-github': t.admin.github,
    'admin-ai-settings': t.admin.aiSettings,
    'admin-document-numbers': t.admin.documentNumbers,
    'admin-system-settings': t.admin.systemSettings,
    'admin-audit-logs': t.admin.auditLogs,
    'admin-jobs': t.admin.jobs,
    'admin-menus': t.admin.menus,
  }

  // Populate from dynamic menus (overrides translations with DB menu labels)
  for (const parent of menus) {
    viewLabels[parent.view] = parent.label
    for (const child of parent.children) {
      viewLabels[child.view] = child.label
    }
  }

  // Find parent menu key for a given view (for admin sub-items etc.)
  const findParentKey = (viewName: string): string | null => {
    for (const parent of menus) {
      if (parent.children.some(c => c.view === viewName)) {
        return parent.key
      }
    }
    return null
  }

  // Build breadcrumb hierarchy
  if (view === 'dashboard') {
    items.push({ label: t.breadcrumbs.dashboard })
  } else if (view === 'projects') {
    const parentMenu = menus.find(m => m.key === 'projects')
    items.push({ label: parentMenu?.label || t.breadcrumbs.projects })
    items.push({ label: t.breadcrumbs.allProjects })
  } else if (view === 'project-detail') {
    const parentMenu = menus.find(m => m.key === 'projects')
    items.push({ label: parentMenu?.label || t.breadcrumbs.projects })
    items.push({ label: t.breadcrumbs.allProjects, view: 'projects' })
    items.push({ label: t.breadcrumbs.projectDetail })
  } else if (view === 'requests') {
    const parentMenu = menus.find(m => m.key === 'requests')
    items.push({ label: parentMenu?.label || t.breadcrumbs.requests })
    items.push({ label: t.breadcrumbs.allRequests })
  } else if (view === 'request-detail') {
    const parentMenu = menus.find(m => m.key === 'requests')
    items.push({ label: parentMenu?.label || t.breadcrumbs.requests })
    items.push({ label: t.breadcrumbs.allRequests, view: 'requests' })
    items.push({ label: t.breadcrumbs.requestDetail })
  } else if (view === 'request-create') {
    const parentMenu = menus.find(m => m.key === 'requests')
    items.push({ label: parentMenu?.label || t.breadcrumbs.requests })
    items.push({ label: t.breadcrumbs.allRequests, view: 'requests' })
    items.push({ label: t.breadcrumbs.createRequest })
  } else if (view === 'work-items') {
    items.push({ label: t.breadcrumbs.workItems, view: 'work-items' })
  } else if (view === 'meetings') {
    items.push({ label: t.breadcrumbs.meetings, view: 'meetings' })
  } else if (view === 'meeting-detail') {
    items.push({ label: t.breadcrumbs.meetings, view: 'meetings' })
    items.push({ label: t.breadcrumbs.meetingDetail })
  } else if (view === 'uat') {
    items.push({ label: t.breadcrumbs.uat, view: 'uat' })
  } else if (view === 'bugs') {
    items.push({ label: t.breadcrumbs.bugs, view: 'bugs' })
  } else if (view === 'bug-detail') {
    items.push({ label: t.breadcrumbs.bugs, view: 'bugs' })
    items.push({ label: t.breadcrumbs.bugDetail })
  } else if (view === 'prompts') {
    items.push({ label: t.breadcrumbs.prompts, view: 'prompts' })
  } else if (view === 'prompt-detail') {
    items.push({ label: t.breadcrumbs.prompts, view: 'prompts' })
    items.push({ label: t.breadcrumbs.promptDetail })
  } else if (view === 'prompt-editor') {
    items.push({ label: t.breadcrumbs.prompts, view: 'prompts' })
    items.push({ label: t.breadcrumbs.promptEditor })
  } else if (view === 'maintenance') {
    items.push({ label: t.breadcrumbs.maintenance, view: 'maintenance' })
  } else if (view === 'notifications') {
    items.push({ label: t.breadcrumbs.notifications, view: 'notifications' })
  } else if (view === 'ai-intake') {
    items.push({ label: t.breadcrumbs.aiIntake, view: 'ai-intake' })
  } else if (view === 'admin') {
    const parentMenu = menus.find(m => m.key === 'admin')
    items.push({ label: parentMenu?.label || t.admin.title })
    items.push({ label: t.breadcrumbs.adminDashboard })
  } else if (view.startsWith('admin-')) {
    const parentKey = findParentKey(view)
    if (parentKey) {
      const parentMenu = menus.find(m => m.key === parentKey)
      items.push({ label: parentMenu?.label || t.admin.title })
      if (view !== 'admin') {
        items.push({ label: t.breadcrumbs.adminDashboard, view: 'admin' })
      }
    } else {
      items.push({ label: t.admin.title })
    }
    items.push({ label: viewLabels[view] || view })
  } else if (view === 'profile') {
    items.push({ label: t.breadcrumbs.profile })
  } else if (view === 'action-inbox') {
    items.push({ label: t.breadcrumbs.actionInbox, view: 'action-inbox' })
  } else if (view === 'change-requests') {
    items.push({ label: t.breadcrumbs.changeRequests, view: 'change-requests' })
  } else if (view === 'reports') {
    items.push({ label: t.breadcrumbs.reports, view: 'reports' })
  } else if (view === 'activity-daily') {
    items.push({ label: t.breadcrumbs.activityDaily, view: 'activity-daily' })
  } else if (view === 'calendar') {
    items.push({ label: t.breadcrumbs.calendar, view: 'calendar' })
  } else if (view === 'platform-request') {
    items.push({ label: t.breadcrumbs.platformRequests, view: 'platform-request' })
  } else if (view === 'platform-request-create') {
    items.push({ label: t.breadcrumbs.platformRequests, view: 'platform-request' })
    items.push({ label: t.breadcrumbs.requestNewPlatform })
  } else if (view === 'platform-request-detail') {
    items.push({ label: t.breadcrumbs.platformRequests, view: 'platform-request' })
    items.push({ label: t.breadcrumbs.platformRequestDetail })
  } else {
    items.push({ label: viewLabels[view] || view })
  }

  return items
}

// ============================================================
// Placeholder view components
// ============================================================

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </motion.div>
    </div>
  )
}

// Suspense loading fallback for lazy pages
function PageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// Wrapper to render lazy components with Suspense
function LazyPage({ component }: { component: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {React.createElement(component)}
    </Suspense>
  )
}

// ============================================================
// Main App Layout
// ============================================================

export default function AppLayout() {
  const {
    user,
    currentView,
    viewParams,
    theme,
    toggleTheme,
    navigate,
    logout,
    menuVersion,
  } = useAppStore()

  const { t } = useI18n()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  // Global search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Dynamic menu state
  const [menus, setMenus] = useState<MenuParent[]>([])
  const [menusLoading, setMenusLoading] = useState(true)
  const [menusError, setMenusError] = useState(false)
  const [expandedMenuKeys, setExpandedMenuKeys] = useState<Set<string>>(new Set())

  // Use ref to track if we have menus for fallback logic (avoids useCallback dep on menus)
  const hasMenusRef = React.useRef(false)

  // ============================================================
  // Fetch menus from API
  // ============================================================

  const fetchMenus = useCallback(async () => {
    try {
      const data = await api.get<{ data: MenuParent[] }>('/api/menus/user')
      const menuTree = data.data ?? []
      setMenus(menuTree)
      setMenusError(false)
      hasMenusRef.current = menuTree.length > 0

      // Initialize expanded state — menus start collapsed by default
      // Only expand if user manually expanded it in this session
      setExpandedMenuKeys((prev) => {
        const next = new Set<string>()
        for (const menu of menuTree) {
          // Only keep expanded if user manually expanded it in this session
          if (prev.has(menu.key)) {
            next.add(menu.key)
          }
        }
        return next
      })
    } catch {
      setMenusError(true)
      // Fallback: just dashboard (only if no menus loaded yet)
      if (!hasMenusRef.current) {
        setMenus([
          {
            id: 'fallback-dashboard',
            key: 'dashboard',
            label: 'Dashboard',
            icon: 'LayoutDashboard',
            view: 'dashboard',
            level: 1,
            sortOrder: 0,
            isVisible: true,
            isExpanded: false,
            requiredPermission: null,
            badge: null,
            badgeVariant: null,
            children: [],
          },
        ])
      }
    } finally {
      setMenusLoading(false)
    }
  }, [])

  // Fetch menus on mount and when menuVersion changes
  useEffect(() => {
    fetchMenus()
  }, [menuVersion, fetchMenus])

  // (No auto-expand — menus stay collapsed by default, user manually toggles)

  // Fetch unread notification count
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await api.get<{ unreadCount: number }>('/api/notifications?limit=1')
        setUnreadNotifications(data.unreadCount || 0)
      } catch {
        // Ignore notification fetch errors
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  // ============================================================
  // Debounced search — 5+ chars → wait 1s after stop typing
  // ============================================================

  useEffect(() => {
    // Clear previous timer
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    const trimmed = searchQuery.trim()
    if (trimmed.length < 3) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)

    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{ data: SearchResult[] }>(`/api/search?keyword=${encodeURIComponent(trimmed)}`)
        const results = res.data ?? []
        setSearchResults(results)
        setSearchOpen(true)
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 1000)

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [searchQuery])

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ============================================================
  // Determine active nav key
  // ============================================================

  const activeNavKey = currentView.split('-')[0] === 'project' ? 'projects'
    : currentView.split('-')[0] === 'request' ? 'requests'
    : currentView.split('-')[0] === 'meeting' ? 'meetings'
    : currentView.split('-')[0] === 'bug' ? 'bugs'
    : currentView.split('-')[0] === 'prompt' ? 'prompts'
    : currentView === 'change-requests' ? 'change-requests'
    : currentView.startsWith('admin') ? 'admin'
    : currentView

  // User initials
  const userInitials = user?.name
    ? (user.name as string).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  // Breadcrumb items
  const breadcrumbItems = getBreadcrumbItems(currentView, viewParams, menus, t)

  // Memoize the lazy component for the current view to avoid re-creating on every render
  const CurrentPage = React.useMemo(() => {
    const loader = PAGE_LOADERS[currentView] || PAGE_LOADERS['dashboard']
    return lazy(loader)
  }, [currentView])

  // Render current view with dynamic loading
  const renderView = () => {
    // Handle placeholder views
    if (currentView === 'bug-detail') {
      return <PlaceholderView title="Bug Detail" description="View bug report details and RCA" />
    }
    if (currentView === 'prompt-editor') {
      return <PlaceholderView title="Prompt Editor" description="Create and edit AI prompts" />
    }

    return <LazyPage component={CurrentPage} />
  }

  // ============================================================
  // Expandable menu toggle
  // ============================================================

  const toggleMenuExpand = (menuKey: string) => {
    setExpandedMenuKeys((prev) => {
      const next = new Set(prev)
      if (next.has(menuKey)) {
        next.delete(menuKey)
      } else {
        next.add(menuKey)
      }
      return next
    })
  }

  // ============================================================
  // Render sidebar nav items (dynamic)
  // ============================================================

  const renderNavItems = () => {
    if (menusLoading && menus.length === 0) {
      // Loading skeleton
      return (
        <div className="flex flex-col gap-1 px-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-5 w-5 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      )
    }

    return (
      <nav className="flex flex-col gap-1">
        {menus.map((menu) => {
          const hasChildren = menu.children && menu.children.length > 0
          const isExpanded = expandedMenuKeys.has(menu.key)
          // Active if: (no children → view matches) OR (has children → one of children matches)
          const isActive = hasChildren
            ? menu.children.some(c => c.view === currentView)
            : (activeNavKey === menu.key || currentView === menu.view)

          const Icon = getIcon(menu.icon)

          // Lv1 item without children: simple nav button
          if (!hasChildren) {
            const button = (
              <button
                onClick={() => {
                  navigate(menu.view)
                  setMobileSidebarOpen(false)
                }}
                className={`
                  group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                  transition-all duration-150
                  ${isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                  ${sidebarCollapsed ? 'justify-center px-2' : ''}
                `}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {!sidebarCollapsed && (
                  <span className="truncate flex-1 text-left">{menu.label}</span>
                )}
                {!sidebarCollapsed && menu.badge && (
                  <Badge
                    variant={
                      menu.badgeVariant === 'destructive' ? 'destructive'
                      : menu.badgeVariant === 'secondary' ? 'secondary'
                      : menu.badgeVariant === 'outline' ? 'outline'
                      : 'default'
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {menu.badge}
                  </Badge>
                )}
              </button>
            )

            if (sidebarCollapsed) {
              return (
                <Tooltip key={menu.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{menu.label}</TooltipContent>
                </Tooltip>
              )
            }

            return <React.Fragment key={menu.id}>{button}</React.Fragment>
          }

          // Lv1 item WITH children: expandable toggle ONLY (no navigation)
          const toggleButton = (
            <button
              onClick={() => {
                // If sidebar is collapsed, expand it first so children are visible
                if (sidebarCollapsed) {
                  setSidebarCollapsed(false)
                }
                toggleMenuExpand(menu.key)
              }}
              className={`
                group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
                ${sidebarCollapsed ? 'justify-center px-2' : ''}
              `}
            >
              <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              {!sidebarCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">{menu.label}</span>
                  {menu.badge && (
                    <Badge
                      variant={
                        menu.badgeVariant === 'destructive' ? 'destructive'
                        : menu.badgeVariant === 'secondary' ? 'secondary'
                        : menu.badgeVariant === 'outline' ? 'outline'
                        : 'default'
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {menu.badge}
                    </Badge>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground ${
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </>
              )}
            </button>
          )

          if (sidebarCollapsed) {
            return (
              <Tooltip key={menu.id}>
                <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{menu.label}</TooltipContent>
              </Tooltip>
            )
          }

          return (
            <div key={menu.id} className={`flex flex-col ${isExpanded ? 'mb-1' : ''}`}>
              {toggleButton}
              {/* Children (Lv2) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden mt-1.5"
                  >
                    <nav className="flex flex-col gap-0.5 ml-3 pl-3 border-l border-border pb-1.5">
                      {menu.children.map((child) => {
                        const isChildActive = currentView === child.view
                        const ChildIcon = getIcon(child.icon)

                        return (
                          <button
                            key={child.id}
                            onClick={() => {
                              navigate(child.view)
                              setMobileSidebarOpen(false)
                            }}
                            className={`
                              flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium
                              transition-all duration-150
                              ${isChildActive
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }
                            `}
                          >
                            <ChildIcon className={`h-4 w-4 shrink-0 ${isChildActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="truncate">{child.label}</span>
                            {child.badge && (
                              <Badge
                                variant={
                                  child.badgeVariant === 'destructive' ? 'destructive'
                                  : child.badgeVariant === 'secondary' ? 'secondary'
                                  : child.badgeVariant === 'outline' ? 'outline'
                                  : 'default'
                                }
                                className="ml-auto text-[9px] px-1 py-0"
                              >
                                {child.badge}
                              </Badge>
                            )}
                          </button>
                        )
                      })}
                    </nav>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>
    )
  }

  // ============================================================
  // Retry button for menu fetch error
  // ============================================================

  const renderMenuRetry = () => {
    if (menusError && !menusLoading) {
      return (
        <div className="px-2 py-2">
          <button
            onClick={() => {
              setMenusLoading(true)
              setMenusError(false)
              fetchMenus()
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {!sidebarCollapsed && <span>{t.common.retryLoadingMenus}</span>}
          </button>
        </div>
      )
    }
    return null
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card
            transition-all duration-300 ease-in-out
            ${sidebarCollapsed ? 'w-[68px]' : 'w-64'}
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          {/* Logo / Brand */}
          <div className={`flex h-16 items-center border-b border-border px-3 ${sidebarCollapsed ? 'justify-center' : 'gap-3 pr-2'}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-hidden"
              >
                <h1 className="truncate text-sm font-bold text-foreground">AI Workflow</h1>
                <p className="truncate text-[10px] text-muted-foreground">Enterprise Platform</p>
              </motion.div>
            )}
            {/* Collapse toggle inside header */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${sidebarCollapsed ? 'mt-0' : ''}`}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Navigation items */}
          <ScrollArea className="flex-1 overflow-hidden px-2 py-3">
            {renderNavItems()}
            {renderMenuRetry()}
          </ScrollArea>

          {/* Sidebar footer */}
          <div className="shrink-0 border-t border-border p-2">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate('profile')}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={user?.avatarUrl as string} alt={user?.name as string} />
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{user?.name as string || 'User'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user?.email as string || ''}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); logout() }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title={t.common.logout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate('profile')}
                      className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-border hover:ring-primary/50 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.avatarUrl as string} alt={user?.name as string} />
                        <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
                      </Avatar>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{user?.name as string || 'User'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={logout}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{t.common.logout}</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </aside>

        {/* Main content area */}
        <div
          className={`
            flex flex-1 flex-col overflow-hidden transition-all duration-300
            ${sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-64'}
          `}
        >
          {/* Top header bar */}
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              <MenuIcon className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>

            {/* Breadcrumb */}
            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                {breadcrumbItems.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {index === breadcrumbItems.length - 1 ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className="cursor-pointer"
                          onClick={() => {
                            if (item.view) {
                              navigate(item.view, item.params || {})
                            }
                          }}
                        >
                          {item.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Global Search (AIT No) — with suggestion dropdown */}
            <div ref={searchContainerRef} className="hidden md:flex items-center max-w-xs w-full relative">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.search.placeholder}
                  className="pl-8 h-8 text-sm pr-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setSearchOpen(true)
                  }}
                />
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                {!searchLoading && searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                      setSearchOpen(false)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-xs">✕</span>
                  </button>
                )}
              </div>

              {/* Suggestion Dropdown */}
              <AnimatePresence>
                {searchOpen && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
                  >
                    <div className="max-h-80 overflow-y-auto scrollbar-thin">
                      {searchResults.map((result, idx) => {
                        const config = SEARCH_TYPE_CONFIG[result.type] || SEARCH_TYPE_CONFIG.DOCUMENT_NUMBER
                        const Icon = config.icon
                        return (
                          <button
                            key={`${result.type}-${result.id}-${idx}`}
                            onClick={() => {
                              if (result.type === 'PROJECT') {
                                navigate('project-detail', { id: result.id })
                              } else if (result.type === 'REQUEST') {
                                navigate('request-detail', { id: result.id })
                              } else if (result.type === 'BUG') {
                                navigate('bugs')
                              } else {
                                navigate(config.view, result.type === 'DOCUMENT_NUMBER' ? {} : { id: result.id })
                              }
                              setSearchOpen(false)
                              setSearchQuery('')
                            }}
                            className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-accent transition-colors"
                          >
                            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {result.aitNo && (
                                  <span className="text-xs font-mono font-semibold text-primary shrink-0">{result.aitNo}</span>
                                )}
                                <span className="text-sm font-medium truncate">{result.title}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  {config.label}
                                </Badge>
                                {result.status && (
                                  <span className="text-[11px] text-muted-foreground">{result.status}</span>
                                )}
                                {result.code && (
                                  <span className="text-[11px] text-muted-foreground font-mono">{result.code}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* No results */}
              <AnimatePresence>
                {searchOpen && !searchLoading && searchResults.length === 0 && searchQuery.trim().length >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground"
                  >
                    No results for &ldquo;{searchQuery}&rdquo;
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Spacer — push icons to the right */}
            <div className="flex-1" />

            {/* Right side actions */}
            <div className="flex items-center gap-1">
              {/* Language switcher */}
              <LanguageSwitcher />

              {/* Theme toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleTheme}>
                    {theme === 'light' ? (
                      <Moon className="h-5 w-5" />
                    ) : (
                      <Sun className="h-5 w-5" />
                    )}
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {theme === 'light' ? t.common.darkMode : t.common.lightMode}
                </TooltipContent>
              </Tooltip>

              {/* Notifications */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    onClick={() => navigate('notifications')}
                  >
                    <Bell className="h-5 w-5" />
                    {unreadNotifications > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]"
                      >
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </Badge>
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.common.notifications}</TooltipContent>
              </Tooltip>

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.avatarUrl as string} alt={user?.name as string} />
                      <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex flex-col gap-1 p-2">
                    <p className="text-sm font-medium">{user?.name as string || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email as string || ''}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('profile')}>
                    <User className="mr-2 h-4 w-4" />
                    {t.common.profile}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('action-inbox')}>
                    <Inbox className="mr-2 h-4 w-4" />
                    {t.actionInbox.title}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-destructive" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t.common.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
