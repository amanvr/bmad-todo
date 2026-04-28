#!/usr/bin/env node
const { existsSync, readdirSync } = require('node:fs');
const { execSync } = require('node:child_process');

const workspaceDirs = ['apps', 'packages'];

const hasWorkspacePackages = workspaceDirs.some(
  (dir) =>
    existsSync(dir) && readdirSync(dir).some((entry) => existsSync(`${dir}/${entry}/package.json`)),
);

if (!hasWorkspacePackages) {
  console.log('[test] No workspace packages yet — nothing to test.');
  process.exit(0);
}

try {
  execSync('npm test --workspaces --if-present', { stdio: 'inherit' });
} catch {
  process.exit(1);
}
