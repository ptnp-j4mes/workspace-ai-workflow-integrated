import { db } from '@/lib/db'

async function main() {
  const count = await db.permission.count()
  console.log(`Total permissions: ${count}`)
  
  if (count > 0) {
    const modules = await db.permission.findMany({
      select: { module: true },
      distinct: ['module'],
    })
    console.log('Modules:', modules.map(m => m.module))
    
    const sample = await db.permission.findMany({ take: 5 })
    sample.forEach(p => console.log(`  - ${p.key}: ${p.name} (${p.module})`))
  }
  
  const roleCount = await db.role.count()
  console.log(`\nTotal roles: ${roleCount}`)
  const roles = await db.role.findMany({ include: { _count: { select: { permissions: true } } } })
  roles.forEach(r => console.log(`  - ${r.key}: ${r.name} (${r._count.permissions} permissions)`))
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
