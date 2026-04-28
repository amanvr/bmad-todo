#!/usr/bin/env node
const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { execSync } = require('node:child_process');

// Run `npm test` only for workspace packages under apps/ and packages/.
// Deliberately excludes e2e/ — Playwright needs browsers installed (handled by the
// dedicated `e2e` CI job) and runs against the live Docker stack, not in the unit
// test loop.
const workspaceDirs = ['apps', 'packages'];

const workspaces = [];
for (const dir of workspaceDirs) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    const pkgPath = `${dir}/${entry}/package.json`;
    if (!existsSync(pkgPath)) continue;
    try {
      const { name } = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (name) workspaces.push(name);
    } catch {
      // skip malformed package.json
    }
  }
}

if (workspaces.length === 0) {
  console.log('[test] No workspace packages yet — nothing to test.');
  process.exit(0);
}

// Ensure cross-package dependencies (notably @bmad-todo/shared) have their
// dist/ artifacts present before consumers try to resolve them. Local dev keeps
// these around between runs, but CI starts clean.
if (existsSync('packages/shared/package.json')) {
  try {
    execSync('npm run build --workspace @bmad-todo/shared', { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

const args = workspaces.flatMap((name) => ['--workspace', name]);
try {
  execSync(`npm test --if-present ${args.join(' ')}`, { stdio: 'inherit' });
} catch {
  process.exit(1);
}
