import { seed } from '../src/lib/seed'
import { seedMenus } from './seed-menus'

async function main() {
  await seed()
  await seedMenus()
}

main()
  .then(() => {
    console.log('🌱 Seeding finished.')
    process.exit(0)
  })
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
