#!/usr/bin/env node
// Bootstrap script for isitdownforturkey
// Run this after all files are in place

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;

console.log('🔧 Bootstrapping isitdownforturkey monorepo...\n');

// 1. Initialize git
console.log('1️⃣  Initializing git repository...');
try {
  execSync('git init', { cwd: root, stdio: 'inherit' });
  execSync('git checkout -b main', { cwd: root, stdio: 'inherit' });
  console.log('   ✓ Git repo initialized\n');
} catch (e) {
  console.log('   ⚠ Git init skipped (may already exist)\n');
}

// 2. Install dependencies
console.log('2️⃣  Installing npm dependencies...');
try {
  execSync('npm install', { cwd: root, stdio: 'inherit', timeout: 120000 });
  console.log('   ✓ Dependencies installed\n');
} catch (e) {
  console.error('   ✗ npm install failed:', e.message);
  process.exit(1);
}

// 3. Typecheck shared package
console.log('3️⃣  Typechecking shared package...');
try {
  execSync('npm run typecheck', { cwd: path.join(root, 'packages/shared'), stdio: 'inherit' });
  console.log('   ✓ Shared types OK\n');
} catch (e) {
  console.error('   ✗ Typecheck failed:', e.message);
}

// 4. Run tests
console.log('4️⃣  Running tests...');
try {
  execSync('npm run test', { cwd: path.join(root, 'packages/shared'), stdio: 'inherit' });
  console.log('   ✓ Tests passed\n');
} catch (e) {
  console.error('   ✗ Tests failed:', e.message);
}

// 5. Initial commit
console.log('5️⃣  Making initial commit...');
try {
  execSync('git add -A', { cwd: root, stdio: 'inherit' });
  execSync('git commit -m "chore: initial commit - Milestone 0 bootstrap" --no-verify', { cwd: root, stdio: 'inherit' });
  console.log('   ✓ Initial commit created\n');
} catch (e) {
  console.log('   ⚠ Commit skipped (nothing to commit or git not initialized)\n');
}

console.log('✅ Bootstrap complete!\n');
console.log('Next steps:');
console.log('  cd packages/shared && npm test    # Run tests');
console.log('  npm run dev                        # Start frontend dev server');
console.log('  cd apps/api && npx wrangler dev    # Start API dev server');
