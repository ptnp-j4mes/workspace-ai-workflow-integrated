import { db } from '@/lib/db'

async function main() {
  console.log('Adding Lv2 children for Lv1 menus that previously navigated...')

  // Find existing Lv1 menus that have children
  const projects = await db.menu.findFirst({ where: { key: 'projects', level: 1 } })
  const requests = await db.menu.findFirst({ where: { key: 'requests', level: 1 } })
  const admin = await db.menu.findFirst({ where: { key: 'admin', level: 1 } })

  if (projects) {
    // Check if "All Projects" child already exists
    const existing = await db.menu.findFirst({ where: { key: 'projects-list' } })
    if (!existing) {
      // Shift existing children sortOrder up by 1
      const children = await db.menu.findMany({ where: { parentId: projects.id } })
      for (const child of children) {
        await db.menu.update({ where: { id: child.id }, data: { sortOrder: child.sortOrder + 1 } })
      }
      // Add "All Projects" as first child
      await db.menu.create({
        data: {
          key: 'projects-list',
          label: 'All Projects',
          icon: 'FolderKanban',
          view: 'projects',
          level: 2,
          sortOrder: 0,
          isVisible: true,
          isExpanded: false,
          parentId: projects.id,
        },
      })
      console.log('✓ Added "All Projects" child to Projects menu')
    } else {
      console.log('- "All Projects" already exists')
    }
  }

  if (requests) {
    const existing = await db.menu.findFirst({ where: { key: 'requests-list' } })
    if (!existing) {
      const children = await db.menu.findMany({ where: { parentId: requests.id } })
      for (const child of children) {
        await db.menu.update({ where: { id: child.id }, data: { sortOrder: child.sortOrder + 1 } })
      }
      await db.menu.create({
        data: {
          key: 'requests-list',
          label: 'All Requests',
          icon: 'FileText',
          view: 'requests',
          level: 2,
          sortOrder: 0,
          isVisible: true,
          isExpanded: false,
          parentId: requests.id,
        },
      })
      console.log('✓ Added "All Requests" child to Requests menu')
    } else {
      console.log('- "All Requests" already exists')
    }
  }

  if (admin) {
    const existing = await db.menu.findFirst({ where: { key: 'admin-overview' } })
    if (!existing) {
      const children = await db.menu.findMany({ where: { parentId: admin.id } })
      for (const child of children) {
        await db.menu.update({ where: { id: child.id }, data: { sortOrder: child.sortOrder + 1 } })
      }
      await db.menu.create({
        data: {
          key: 'admin-overview',
          label: 'Dashboard',
          icon: 'LayoutDashboard',
          view: 'admin',
          level: 2,
          sortOrder: 0,
          isVisible: true,
          isExpanded: false,
          parentId: admin.id,
          requiredPermission: 'admin',
        },
      })
      console.log('✓ Added "Dashboard" child to Admin menu')
    } else {
      console.log('- "Dashboard" already exists')
    }
  }

  const count = await db.menu.count()
  console.log(`Total menu items: ${count}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
