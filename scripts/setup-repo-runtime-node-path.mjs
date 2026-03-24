#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const runtimeRoot = path.join(repoRoot, '.repo-runtime');
const nodeModulesRoot = path.join(runtimeRoot, 'node_modules');

const packageMap = new Map([
  ['@paperclipai/shared', 'packages/shared'],
  ['@paperclipai/db', 'packages/db'],
  ['@paperclipai/adapter-utils', 'packages/adapter-utils'],
  ['@paperclipai/adapter-claude-local', 'packages/adapters/claude-local'],
  ['@paperclipai/adapter-codex-local', 'packages/adapters/codex-local'],
  ['@paperclipai/adapter-cursor-local', 'packages/adapters/cursor-local'],
  ['@paperclipai/adapter-gemini-local', 'packages/adapters/gemini-local'],
  ['@paperclipai/adapter-openclaw-gateway', 'packages/adapters/openclaw-gateway'],
  ['@paperclipai/adapter-opencode-local', 'packages/adapters/opencode-local'],
  ['@paperclipai/adapter-pi-local', 'packages/adapters/pi-local'],
]);

fs.rmSync(runtimeRoot, { recursive: true, force: true });
fs.mkdirSync(nodeModulesRoot, { recursive: true });

for (const [name, relDir] of packageMap) {
  const pkgDir = path.join(repoRoot, relDir);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const data = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const outDir = path.join(pkgDir, 'dist');
  const scopeDir = path.join(nodeModulesRoot, ...name.split('/').slice(0, -1));
  const targetDir = path.join(nodeModulesRoot, ...name.split('/'));
  fs.mkdirSync(scopeDir, { recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });

  const exportEntries = data.exports ?? { '.': './dist/index.js' };
  const rewritten = {};
  for (const [key, value] of Object.entries(exportEntries)) {
    if (typeof value === 'string') {
      rewritten[key] = value.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js');
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      rewritten[key] = {
        ...value,
        ...(typeof value.import === 'string' ? { import: value.import.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js') } : {}),
        ...(typeof value.default === 'string' ? { default: value.default.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js') } : {}),
      };
    } else {
      rewritten[key] = value;
    }
  }

  const runtimePkg = {
    name,
    type: data.type ?? 'module',
    exports: rewritten,
  };

  fs.writeFileSync(path.join(targetDir, 'package.json'), `${JSON.stringify(runtimePkg, null, 2)}\n`, 'utf8');
  const distLink = path.join(targetDir, 'dist');
  fs.symlinkSync(outDir, distLink, 'dir');
}

console.error(`repo-runtime node_modules ready: ${nodeModulesRoot}`);
console.log(runtimeRoot);
