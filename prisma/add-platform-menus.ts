import { db } from '@/lib/db'

async function main() {
  console.log('Adding Platform Request menu items...')

  // Find the Projects menu (lv1) to add platform request as a child
  const projectsMenu = await db.menu.findFirst({ where: { key: 'projects', level: 1 } })
  
  if (!projectsMenu) {
    console.error('Projects menu not found!')
    return
  }

  // Check if platform-request menu already exists
  const existing = await db.menu.findFirst({ where: { key: 'platform-request' } })
  if (existing) {
    console.log('- Platform Request menu already exists')
    return
  }

  // Get current max sortOrder for projects children
  const children = await db.menu.findMany({ 
    where: { parentId: projectsMenu.id },
    orderBy: { sortOrder: 'desc' },
    take: 1
  })
  const nextSort = (children[0]?.sortOrder ?? -1) + 1

  // Add Platform Request as Lv2 child under Projects
  await db.menu.create({
    data: {
      key: 'platform-request',
      label: 'Platform Request',
      icon: 'Monitor',
      view: 'platform-request',
      level: 2,
      sortOrder: nextSort,
      isVisible: true,
      isExpanded: false,
      parentId: projectsMenu.id,
    },
  })
  console.log('✓ Added "Platform Request" as child of Projects menu')

  // Also add "My Projects" tracking view as another child (for non-SD users to track their project progress)
  const existingMyProjects = await db.menu.findFirst({ where: { key: 'my-projects' } })
  if (!existingMyProjects) {
    await db.menu.create({
      data: {
        key: 'my-projects',
        label: 'My Projects',
        icon: 'FolderCheck',
        view: 'projects', // Uses the same projects page but filtered for user's projects
        level: 2,
        sortOrder: nextSort + 1,
        isVisible: true,
        isExpanded: false,
        parentId: projectsMenu.id,
      },
    })
    console.log('✓ Added "My Projects" as child of Projects menu')
  } else {
    console.log('- My Projects menu already exists')
  }

  const count = await db.menu.count()
  console.log(`Total menu items: ${count}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
