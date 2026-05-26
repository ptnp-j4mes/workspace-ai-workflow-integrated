import { db } from '../src/lib/db'

async function main() {
  const settings = [
    { key: 'UPLOAD_MODE', value: 'LOCAL', valueType: 'STRING', category: 'STORAGE', isSecret: false, description: 'Upload mode: LOCAL or API' },
    { key: 'UPLOAD_LOCAL_PATH', value: './upload', valueType: 'STRING', category: 'STORAGE', isSecret: false, description: 'Local directory path for file uploads' },
    { key: 'UPLOAD_API_URL', value: '', valueType: 'STRING', category: 'STORAGE', isSecret: false, description: 'External API endpoint URL for file uploads' },
    { key: 'UPLOAD_API_KEY', value: '', valueType: 'STRING', category: 'STORAGE', isSecret: true, description: 'API key for external upload service' },
    { key: 'UPLOAD_MAX_SIZE_MB', value: '50', valueType: 'NUMBER', category: 'STORAGE', isSecret: false, description: 'Maximum file size in MB' },
    { key: 'UPLOAD_ALLOWED_TYPES', value: 'image/*,application/pdf,text/*,.md,.json,.csv,.xlsx,.docx,.pptx', valueType: 'STRING', category: 'STORAGE', isSecret: false, description: 'Allowed file types (comma-separated MIME types or extensions)' },
  ]

  for (const setting of settings) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, category: setting.category, description: setting.description },
      create: setting,
    })
  }

  console.log('Storage settings seeded!')
}

main().catch(console.error).finally(() => db.$disconnect())
