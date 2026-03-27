#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const runtimeRoot = process.env.PAPERCLIP_RUNTIME_ROOT || '/home/jorge/dev/paperclip-live-runtime';

const packageDirs = [
  'packages/shared',
  'packages/db',
  'packages/adapter-utils',
  'packages/plugins/sdk',
  'packages/adapters/claude-local',
  'packages/adapters/codex-local',
  'packages/adapters/cursor-local',
  'packages/adapters/gemini-local',
  'packages/adapters/openclaw-gateway',
  'packages/adapters/opencode-local',
  'packages/adapters/pi-local',
  'server',
];

function rmSafe(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function mkdirp(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyRecursive(src, dest) {
  mkdirp(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function writeJson(filePath, value) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function rewriteExportTarget(value) {
  return value.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js');
}

function rewriteTypesTarget(value) {
  return value.replace(/^\.\/src\//, './dist/').replace(/(?<!\.d)\.ts$/, '.d.ts');
}

function stagedPackageJsonFor(rel) {
  const srcPath = path.join(repoRoot, rel, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const sourceExports = pkg.publishConfig?.exports ?? pkg.exports ?? { '.': './src/index.ts' };
  const rewritten = {};

  for (const [key, value] of Object.entries(sourceExports)) {
    if (typeof value === 'string') {
      rewritten[key] = rewriteExportTarget(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      rewritten[key] = {
        ...value,
        ...(typeof value.import === 'string' ? { import: rewriteExportTarget(value.import) } : {}),
        ...(typeof value.require === 'string' ? { require: rewriteExportTarget(value.require) } : {}),
        ...(typeof value.default === 'string' ? { default: rewriteExportTarget(value.default) } : {}),
        ...(typeof value.types === 'string' ? { types: rewriteTypesTarget(value.types) } : {}),
      };
    } else {
      rewritten[key] = value;
    }
  }

  delete pkg.publishConfig;
  delete pkg.repoRuntimeExportsBackup;

  pkg.exports = rewritten;
  if (pkg.exports['.'] && typeof pkg.exports['.'] === 'string') {
    pkg.main = pkg.exports['.'];
  } else if (pkg.exports['.']?.import) {
    pkg.main = pkg.exports['.'].import;
  }

  if (pkg.exports['.']?.types) {
    pkg.types = pkg.exports['.'].types;
  }

  return pkg;
}

rmSafe(runtimeRoot);
mkdirp(runtimeRoot);

copyRecursive(path.join(repoRoot, 'pnpm-lock.yaml'), path.join(runtimeRoot, 'pnpm-lock.yaml'));
copyRecursive(path.join(repoRoot, 'pnpm-workspace.yaml'), path.join(runtimeRoot, 'pnpm-workspace.yaml'));

const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
rootPkg.private = true;
rootPkg.scripts = {
  start: 'node server/dist/index.js'
};
writeJson(path.join(runtimeRoot, 'package.json'), rootPkg);

for (const rel of packageDirs) {
  const srcDir = path.join(repoRoot, rel);
  const destDir = path.join(runtimeRoot, rel);
  mkdirp(destDir);

  writeJson(path.join(destDir, 'package.json'), stagedPackageJsonFor(rel));

  const distDir = path.join(srcDir, 'dist');
  if (fs.existsSync(distDir)) {
    copyRecursive(distDir, path.join(destDir, 'dist'));
  }

  if (rel === 'server') {
    const uiDist = path.join(srcDir, 'ui-dist');
    if (fs.existsSync(uiDist)) {
      copyRecursive(uiDist, path.join(destDir, 'ui-dist'));
    }
  }
}

const runtimeMeta = {
  sourceRepo: repoRoot,
  assembledAt: new Date().toISOString(),
  runtimeRoot,
  strategy: 'staged-runtime-workspace-install',
};
writeJson(path.join(runtimeRoot, '.paperclip-runtime.json'), runtimeMeta);

console.log(runtimeRoot);
