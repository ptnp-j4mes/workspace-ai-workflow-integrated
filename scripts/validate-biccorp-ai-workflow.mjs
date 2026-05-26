#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'AGENTS.md',
  'BICCORP-AI-WORKFLOW.md',
  '.github/pull_request_template.md',
  '.github/workflows/biccorp-ai-workflow-check.yml',
  'ai-workflow/templates/implementation-brief.md',
  'ai-workflow/templates/hermes-dependency-review.md',
  'ai-workflow/templates/codex-implementation-report.md',
  'ai-workflow/templates/github-audit-checklist.md',
  'ai-workflow/policies/codex-control-policy.md',
  'ai-workflow/policies/hermes-release-policy.md',
  'ai-workflow/policies/web-quality-policy.md',
  'ai-workflow/policies/memory-vault-policy.md',
  'memory-vault/README.md'
];

let failed = false;
for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error(`Missing required workflow file: ${rel}`);
    failed = true;
  }
}

const forbidden = ['.env', '.env.local', '.DS_Store'];
for (const name of forbidden) {
  if (fs.existsSync(path.join(root, name))) {
    console.error(`Forbidden local/sensitive artifact present at repo root: ${name}`);
    failed = true;
  }
}

const prTemplate = path.join(root, '.github/pull_request_template.md');
if (fs.existsSync(prTemplate)) {
  const body = fs.readFileSync(prTemplate, 'utf8');
  for (const marker of ['Request ID', 'Tests / Validation', 'Rollback Plan', 'Memory Vault']) {
    if (!body.includes(marker)) {
      console.error(`PR template missing marker: ${marker}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('BICCORP AI workflow validation passed.');
