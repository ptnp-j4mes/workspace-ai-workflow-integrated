import { db } from '@/lib/db'

// ============================================================
// Seed Menu items from current app-layout.tsx sidebar navigation
// ============================================================

async function main() {
  console.log('Seeding menus...')

  // Clear existing menus
  await db.menuPermission.deleteMany()
  await db.menu.deleteMany()

  // Create lv1 menus first, then lv2 children

  // 1. Dashboard
  const dashboard = await db.menu.create({
    data: { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', view: 'dashboard', level: 1, sortOrder: 0, isVisible: true, isExpanded: false },
  })

  // 2. Action Inbox
  const actionInbox = await db.menu.create({
    data: { key: 'action-inbox', label: 'Action Inbox', icon: 'Inbox', view: 'action-inbox', level: 1, sortOrder: 1, isVisible: true, isExpanded: false },
  })

  // 3. Projects (expanded, with children)
  const projects = await db.menu.create({
    data: { key: 'projects', label: 'Projects', icon: 'FolderKanban', view: 'projects', level: 1, sortOrder: 2, isVisible: true, isExpanded: false },
  })
  await db.menu.create({
    data: { key: 'projects-list', label: 'All Projects', icon: 'FolderKanban', view: 'projects', level: 2, sortOrder: 0, isVisible: true, parentId: projects.id },
  })
  await db.menu.create({
    data: { key: 'project-detail', label: 'Project Detail', icon: 'FolderKanban', view: 'project-detail', level: 2, sortOrder: 1, isVisible: true, parentId: projects.id },
  })
  await db.menu.create({
    data: { key: 'platform-request', label: 'Platform Request', icon: 'Monitor', view: 'platform-request', level: 2, sortOrder: 2, isVisible: true, parentId: projects.id },
  })
  await db.menu.create({
    data: { key: 'my-projects', label: 'My Projects', icon: 'FolderCheck', view: 'projects', level: 2, sortOrder: 3, isVisible: true, parentId: projects.id },
  })

  // 4. Requests (expanded, with children)
  const requests = await db.menu.create({
    data: { key: 'requests', label: 'Requests', icon: 'FileText', view: 'requests', level: 1, sortOrder: 3, isVisible: true, isExpanded: false },
  })
  await db.menu.create({
    data: { key: 'requests-list', label: 'All Requests', icon: 'FileText', view: 'requests', level: 2, sortOrder: 0, isVisible: true, parentId: requests.id },
  })
  await db.menu.create({
    data: { key: 'request-create', label: 'Create Request', icon: 'FileText', view: 'request-create', level: 2, sortOrder: 1, isVisible: true, parentId: requests.id },
  })
  await db.menu.create({
    data: { key: 'request-detail', label: 'Request Detail', icon: 'FileText', view: 'request-detail', level: 2, sortOrder: 2, isVisible: true, parentId: requests.id },
  })

  // 5. Work Items
  await db.menu.create({
    data: { key: 'work-items', label: 'Work Items', icon: 'ClipboardList', view: 'work-items', level: 1, sortOrder: 4, isVisible: true, isExpanded: false },
  })

  // 6. Meetings
  await db.menu.create({
    data: { key: 'meetings', label: 'Meetings', icon: 'Video', view: 'meetings', level: 1, sortOrder: 5, isVisible: true, isExpanded: false },
  })

  // 7. UAT
  await db.menu.create({
    data: { key: 'uat', label: 'UAT', icon: 'TestTube2', view: 'uat', level: 1, sortOrder: 6, isVisible: true, isExpanded: false },
  })

  // 8. Bugs
  await db.menu.create({
    data: { key: 'bugs', label: 'Bugs', icon: 'Bug', view: 'bugs', level: 1, sortOrder: 7, isVisible: true, isExpanded: false },
  })

  // 9. Changes
  await db.menu.create({
    data: { key: 'change-requests', label: 'Changes', icon: 'GitPullRequest', view: 'change-requests', level: 1, sortOrder: 8, isVisible: true, isExpanded: false },
  })

  // 10. Reports
  await db.menu.create({
    data: { key: 'reports', label: 'Reports', icon: 'BarChart3', view: 'reports', level: 1, sortOrder: 9, isVisible: true, isExpanded: false },
  })

  // 11. Activity Daily
  await db.menu.create({
    data: { key: 'activity-daily', label: 'Activity Daily', icon: 'Activity', view: 'activity-daily', level: 1, sortOrder: 10, isVisible: true, isExpanded: false },
  })

  // 12. Maintenance
  await db.menu.create({
    data: { key: 'maintenance', label: 'Maintenance', icon: 'Shield', view: 'maintenance', level: 1, sortOrder: 11, isVisible: true, isExpanded: false },
  })

  // 13. AI Prompt Studio
  await db.menu.create({
    data: { key: 'prompts', label: 'AI Prompt Studio', icon: 'Sparkles', view: 'prompts', level: 1, sortOrder: 12, isVisible: true, isExpanded: false },
  })

  // 14. Calendar (NEW)
  await db.menu.create({
    data: { key: 'calendar', label: 'Calendar', icon: 'CalendarDays', view: 'calendar', level: 1, sortOrder: 13, isVisible: true, isExpanded: false },
  })

  // 15. Admin (expanded, with children)
  const admin = await db.menu.create({
    data: { key: 'admin', label: 'Admin', icon: 'Settings', view: 'admin', level: 1, sortOrder: 14, isVisible: true, isExpanded: false, requiredPermission: 'admin' },
  })

  // Admin lv2 children
  const adminChildren = [
    { key: 'admin-overview', label: 'Dashboard', icon: 'LayoutDashboard', view: 'admin', sortOrder: 0, requiredPermission: 'admin' },
    { key: 'admin-users', label: 'Users', icon: 'Users', view: 'admin-users', sortOrder: 1, requiredPermission: 'admin' },
    { key: 'admin-roles', label: 'Roles & Permissions', icon: 'Shield', view: 'admin-roles', sortOrder: 2, requiredPermission: 'admin' },
    { key: 'admin-departments', label: 'Departments', icon: 'Building', view: 'admin-departments', sortOrder: 3, requiredPermission: 'admin' },
    { key: 'admin-approval-workflows', label: 'Approval Workflows', icon: 'CheckSquare', view: 'admin-approval-workflows', sortOrder: 4, requiredPermission: 'admin' },
    { key: 'admin-notification-rules', label: 'Notification Rules', icon: 'Bell', view: 'admin-notification-rules', sortOrder: 5, requiredPermission: 'admin' },
    { key: 'admin-smtp', label: 'SMTP Settings', icon: 'Mail', view: 'admin-smtp', sortOrder: 6, requiredPermission: 'admin' },
    { key: 'admin-email-templates', label: 'Email Templates', icon: 'FileCode', view: 'admin-email-templates', sortOrder: 7, requiredPermission: 'admin' },
    { key: 'admin-email-logs', label: 'Email Logs', icon: 'ScrollText', view: 'admin-email-logs', sortOrder: 8, requiredPermission: 'admin' },
    { key: 'admin-github', label: 'GitHub Integration', icon: 'Github', view: 'admin-github', sortOrder: 9, requiredPermission: 'admin' },
    { key: 'admin-ai-settings', label: 'AI Settings', icon: 'Bot', view: 'admin-ai-settings', sortOrder: 10, requiredPermission: 'admin' },
    { key: 'admin-document-numbers', label: 'Document Numbers', icon: 'Hash', view: 'admin-document-numbers', sortOrder: 11, requiredPermission: 'admin' },
    { key: 'admin-system-settings', label: 'System Settings', icon: 'Settings', view: 'admin-system-settings', sortOrder: 12, requiredPermission: 'admin' },
    { key: 'admin-audit-logs', label: 'Audit Logs', icon: 'FileSearch', view: 'admin-audit-logs', sortOrder: 13, requiredPermission: 'admin' },
    { key: 'admin-jobs', label: 'Background Jobs', icon: 'Clock', view: 'admin-jobs', sortOrder: 14, requiredPermission: 'admin' },
    { key: 'admin-menus', label: 'Menu Management', icon: 'MenuIcon', view: 'admin-menus', sortOrder: 15, requiredPermission: 'admin' },
    { key: 'admin-google-settings', label: 'Google Service Settings', icon: 'Cloud', view: 'admin-google-settings', sortOrder: 16, requiredPermission: 'admin' },
  ]

  for (const child of adminChildren) {
    await db.menu.create({
      data: {
        key: child.key,
        label: child.label,
        icon: child.icon,
        view: child.view,
        level: 2,
        sortOrder: child.sortOrder,
        isVisible: true,
        isExpanded: false,
        parentId: admin.id,
        requiredPermission: child.requiredPermission,
      },
    })
  }

  const count = await db.menu.count()
  console.log(`Seeded ${count} menu items successfully!`)
}

main()
  .catch((e) => {
    console.error('Error seeding menus:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
