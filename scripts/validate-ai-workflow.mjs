import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'ai-workflow/README.md',
  'ai-workflow/brief-template.md',
  'ai-workflow/hermes-dependency-review.md',
  'ai-workflow/codex-implementation-report.md',
  'ai-workflow/github-audit-checklist.md',
  '.github/pull_request_template.md',
  '.github/CODEOWNERS',
  'memory-vault/README.md',
  'memory-vault/decisions/ADR-0000-ai-delivery-workflow.md',
  'memory-vault/patterns/ai-delivery-pipeline.md',
  'memory-vault/patterns/testing-and-release-gates.md',
]

const requiredDirs = [
  'memory-vault/decisions',
  'memory-vault/patterns',
  'memory-vault/modules',
  'memory-vault/releases',
]

let failed = false

function fail(message) {
  console.error(`FAIL: ${message}`)
  failed = true
}

function pass(message) {
  console.log(`PASS: ${message}`)
}

for (const file of requiredFiles) {
  const filePath = path.join(root, file)
  if (!fs.existsSync(filePath)) {
    fail(`missing file ${file}`)
    continue
  }
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    fail(`${file} is not a file`)
    continue
  }
  const content = fs.readFileSync(filePath, 'utf8').trim()
  if (!content) {
    fail(`${file} is empty`)
    continue
  }
  pass(`found ${file}`)
}

for (const dir of requiredDirs) {
  const dirPath = path.join(root, dir)
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    fail(`missing directory ${dir}`)
  } else {
    pass(`found ${dir}`)
  }
}

const packageJsonPath = path.join(root, 'package.json')
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  if (pkg.scripts?.['workflow:validate'] !== 'node scripts/validate-ai-workflow.mjs') {
    fail('package.json is missing scripts.workflow:validate')
  } else {
    pass('package.json has workflow:validate script')
  }
}

const prTemplate = fs.readFileSync(path.join(root, '.github/pull_request_template.md'), 'utf8')
for (const term of ['Request ID', 'Hermes', 'Codex', 'Rollback plan']) {
  if (!prTemplate.includes(term)) {
    fail(`PR template missing ${term}`)
  }
}

if (failed) {
  process.exit(1)
}

console.log('\nAI workflow validation passed.')
