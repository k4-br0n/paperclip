#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

REPO_ROOT="/home/jorge/dev/paperclip-dev"
cd "$REPO_ROOT"

if [ -f .env.devlocal ]; then
  set -a
  . ./.env.devlocal
  set +a
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3111}"
export HOST="${HOST:-127.0.0.1}"
export PAPERCLIP_HOME="${PAPERCLIP_HOME:-/home/jorge/dev/paperclip-dev-home}"
export PAPERCLIP_UI_DEV_MIDDLEWARE="false"
export PAPERCLIP_MIGRATION_PROMPT="never"
export PAPERCLIP_MIGRATION_AUTO_APPLY="true"

if [ ! -f "$REPO_ROOT/server/dist/index.js" ] || [ ! -f "$REPO_ROOT/server/ui-dist/index.html" ]; then
  npx --yes pnpm@9.15.4 --dir "$REPO_ROOT" -r build
  bash "$REPO_ROOT/scripts/prepare-server-ui-dist.sh"
fi

node --input-type=module <<'EOF'
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/home/jorge/dev/paperclip-dev';
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
EOF

cleanup() {
  node --input-type=module <<'EOF'
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/home/jorge/dev/paperclip-dev';
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
EOF
}
trap cleanup EXIT INT TERM

exec node "$REPO_ROOT/server/dist/index.js"
