import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding departments and job positions...')

  // Clear existing data
  await prisma.jobPosition.deleteMany()
  await prisma.department.deleteMany()

  // ============================================================
  // Create Division: SD (Software Development)
  // ============================================================
  const sdDivision = await prisma.department.create({
    data: {
      name: 'แผนกวิเคราะห์ข้อมูล',
      code: 'SD',
      type: 'DIVISION',
      description: 'SD-ฝ่ายวิเคราะห์และพัฒนาซอฟต์แวร์',
      sortOrder: 1,
      isActive: true,
    },
  })
  console.log(`✅ Created division: ${sdDivision.code} - ${sdDivision.name}`)

  // ============================================================
  // Create Sections under SD
  // ============================================================
  const sections = [
    { name: 'Business Analysis', code: 'BA', description: 'SD-BA ฝ่าย Business Analysis', sortOrder: 1 },
    { name: 'Information Technology', code: 'IT', description: 'SD-IT ฝ่าย Information Technology', sortOrder: 2 },
    { name: 'Project Management', code: 'PM', description: 'SD-PM ฝ่าย Project Management', sortOrder: 3 },
    { name: 'Quality Assurance', code: 'QA', description: 'SD-QA ฝ่าย Quality Assurance', sortOrder: 4 },
    { name: 'Full Stack', code: 'FS', description: 'SD-FS ฝ่าย Full Stack Development', sortOrder: 5 },
  ]

  const createdSections = []
  for (const section of sections) {
    const created = await prisma.department.create({
      data: {
        name: section.name,
        code: section.code,
        type: 'SECTION',
        description: section.description,
        parentId: sdDivision.id,
        sortOrder: section.sortOrder,
        isActive: true,
      },
    })
    createdSections.push(created)
    console.log(`  ✅ Created section: ${created.code} - ${created.name}`)
  }

  // ============================================================
  // Create Job Positions
  // ============================================================
  const positions = [
    // Engineering
    { name: 'Junior Developer', code: 'JD', level: 'J1', category: 'ENGINEERING', sortOrder: 1, departmentId: createdSections[4].id },
    { name: 'Developer', code: 'DEV', level: 'J2', category: 'ENGINEERING', sortOrder: 2, departmentId: createdSections[4].id },
    { name: 'Senior Developer', code: 'SD', level: 'J3', category: 'ENGINEERING', sortOrder: 3, departmentId: createdSections[4].id },
    { name: 'Lead Developer', code: 'LD', level: 'M1', category: 'ENGINEERING', sortOrder: 4, departmentId: createdSections[4].id },
    { name: 'IT Support', code: 'ITS', level: 'J1', category: 'ENGINEERING', sortOrder: 5, departmentId: createdSections[1].id },
    { name: 'IT Administrator', code: 'ITA', level: 'J2', category: 'ENGINEERING', sortOrder: 6, departmentId: createdSections[1].id },
    { name: 'IT Manager', code: 'ITM', level: 'M2', category: 'ENGINEERING', sortOrder: 7, departmentId: createdSections[1].id },
    // Business
    { name: 'Junior Business Analyst', code: 'JBA', level: 'J1', category: 'BUSINESS', sortOrder: 8, departmentId: createdSections[0].id },
    { name: 'Business Analyst', code: 'BA', level: 'J2', category: 'BUSINESS', sortOrder: 9, departmentId: createdSections[0].id },
    { name: 'Senior Business Analyst', code: 'SBA', level: 'J3', category: 'BUSINESS', sortOrder: 10, departmentId: createdSections[0].id },
    { name: 'System Analyst', code: 'SA', level: 'J3', category: 'BUSINESS', sortOrder: 11, departmentId: createdSections[0].id },
    // Management
    { name: 'Project Coordinator', code: 'PC', level: 'J2', category: 'MANAGEMENT', sortOrder: 12, departmentId: createdSections[2].id },
    { name: 'Project Manager', code: 'PM', level: 'M1', category: 'MANAGEMENT', sortOrder: 13, departmentId: createdSections[2].id },
    { name: 'Senior Project Manager', code: 'SPM', level: 'M2', category: 'MANAGEMENT', sortOrder: 14, departmentId: createdSections[2].id },
    { name: 'Program Manager', code: 'PGM', level: 'D1', category: 'MANAGEMENT', sortOrder: 15, departmentId: createdSections[2].id },
    // Support / QA
    { name: 'QA Tester', code: 'QT', level: 'J1', category: 'SUPPORT', sortOrder: 16, departmentId: createdSections[3].id },
    { name: 'QA Engineer', code: 'QE', level: 'J2', category: 'SUPPORT', sortOrder: 17, departmentId: createdSections[3].id },
    { name: 'Senior QA Engineer', code: 'SQE', level: 'J3', category: 'SUPPORT', sortOrder: 18, departmentId: createdSections[3].id },
    { name: 'QA Lead', code: 'QL', level: 'M1', category: 'SUPPORT', sortOrder: 19, departmentId: createdSections[3].id },
    // Executives
    { name: 'Division Manager', code: 'DM', level: 'D1', category: 'MANAGEMENT', sortOrder: 20, departmentId: null },
    { name: 'Director', code: 'DIR', level: 'D2', category: 'MANAGEMENT', sortOrder: 21, departmentId: null },
    { name: 'VP', code: 'VP', level: 'EXE', category: 'MANAGEMENT', sortOrder: 22, departmentId: null },
  ]

  for (const pos of positions) {
    await prisma.jobPosition.create({ data: pos })
  }
  console.log(`✅ Created ${positions.length} job positions`)

  // ============================================================
  // Assign existing users to departments
  // ============================================================
  const users = await prisma.user.findMany()
  if (users.length > 0) {
    // Assign first user to SD division as Division Manager
    await prisma.user.update({
      where: { id: users[0].id },
      data: {
        departmentId: sdDivision.id,
        position: 'Division Manager',
      },
    })
    console.log(`✅ Assigned ${users[0].name} to ${sdDivision.code}`)

    // Distribute other users across sections
    const sectionAssignments = [createdSections[4], createdSections[0], createdSections[2], createdSections[3], createdSections[1]]
    const positionNames = ['Developer', 'Business Analyst', 'Project Manager', 'QA Engineer', 'IT Administrator']
    for (let i = 1; i < users.length && i <= 5; i++) {
      const section = sectionAssignments[(i - 1) % sectionAssignments.length]
      await prisma.user.update({
        where: { id: users[i].id },
        data: {
          departmentId: section.id,
          position: positionNames[(i - 1) % positionNames.length],
        },
      })
      console.log(`✅ Assigned ${users[i].name} to ${section.code} as ${positionNames[(i - 1) % positionNames.length]}`)
    }
  }

  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
