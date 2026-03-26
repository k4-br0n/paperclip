#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const packages = [
  'packages/shared',
  'packages/db',
  'packages/adapter-utils',
  'packages/adapters/claude-local',
  'packages/adapters/codex-local',
  'packages/adapters/cursor-local',
  'packages/adapters/gemini-local',
  'packages/adapters/openclaw-gateway',
  'packages/adapters/opencode-local',
  'packages/adapters/pi-local',
];

for (const rel of packages) {
  const pkgJsonPath = path.join(repoRoot, rel, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.repoRuntimeExportsBackup) {
    pkg.exports = pkg.repoRuntimeExportsBackup;
    delete pkg.repoRuntimeExportsBackup;
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }
}

console.error('repo runtime exports restored');
