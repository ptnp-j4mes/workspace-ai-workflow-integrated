import { db } from '@/lib/db'

async function main() {
  const result = await db.menu.updateMany({
    where: { isExpanded: true },
    data: { isExpanded: false },
  })
  console.log(`Updated ${result.count} menus to isExpanded: false`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
