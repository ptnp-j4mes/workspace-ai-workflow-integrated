#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const sourceRoot = path.resolve(path.dirname(__filename), '..');
const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();
if (!target) {
  console.error('Usage: node scripts/install-biccorp-workflow.mjs --target /path/to/project');
  process.exit(1);
}

const skip = new Set(['.git', 'node_modules', '.next']);
function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const name = path.basename(src);
    if (skip.has(name)) return;
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    if (fs.existsSync(dst)) {
      const backup = `${dst}.biccorp-backup`;
      if (!fs.existsSync(backup)) fs.copyFileSync(dst, backup);
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

for (const entry of ['AGENTS.md', 'BICCORP-AI-WORKFLOW.md', 'ai-workflow', '.github', 'memory-vault', 'scripts']) {
  copyRecursive(path.join(sourceRoot, entry), path.join(target, entry));
}
console.log(`Installed BICCORP workflow into ${target}`);
console.log('Run: node scripts/validate-biccorp-ai-workflow.mjs');
