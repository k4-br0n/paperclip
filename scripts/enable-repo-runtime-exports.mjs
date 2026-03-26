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
  if (!pkg.repoRuntimeExportsBackup && pkg.exports) {
    pkg.repoRuntimeExportsBackup = pkg.exports;
  }
  const sourceExports = pkg.repoRuntimeExportsBackup ?? pkg.exports ?? { '.': './src/index.ts' };
  const rewritten = {};
  for (const [key, value] of Object.entries(sourceExports)) {
    if (typeof value === 'string') {
      rewritten[key] = value.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js');
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      rewritten[key] = {
        ...value,
        ...(typeof value.import === 'string' ? { import: value.import.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js') } : {}),
        ...(typeof value.default === 'string' ? { default: value.default.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js') } : {}),
        ...(typeof value.types === 'string' ? { types: value.types.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.d.ts') } : {}),
      };
    } else {
      rewritten[key] = value;
    }
  }
  pkg.exports = rewritten;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

console.error('repo runtime exports enabled');
