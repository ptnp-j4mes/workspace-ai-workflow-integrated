import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const removePaths = [
  '.next',
  'node_modules',
  '__MACOSX',
  '.DS_Store',
  'dev.log',
  'server.log',
  'dev.out.log',
  'next-dev.pid',
]

let removed = 0

for (const target of removePaths) {
  const fullPath = path.join(root, target)
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true })
    console.log(`removed ${target}`)
    removed += 1
  }
}

for (const entry of fs.readdirSync(root)) {
  if (entry.endsWith('.log') || entry.endsWith('.pid')) {
    fs.rmSync(path.join(root, entry), { recursive: true, force: true })
    console.log(`removed ${entry}`)
    removed += 1
  }
}

if (removed === 0) {
  console.log('No local artifacts found.')
}
