import { seed } from '../src/lib/seed'

seed()
  .then(() => {
    console.log('🌱 Seeding finished.')
    process.exit(0)
  })
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
