#!/usr/bin/env node
/**
 * Combined build script - runs CSS build then esbuild, copies manifest.json to dist/
 */

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Ensure dist/
const distDir = join(ROOT, 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Run CSS build
execSync('node scripts/build-css.mjs', { cwd: ROOT, stdio: 'inherit' });

// Run esbuild with args passed through
const args = process.argv.slice(2).join(' ');
execSync(`node esbuild.config.mjs ${args}`, { cwd: ROOT, stdio: 'inherit' });

// Copy manifest.json to dist/
copyFileSync(join(ROOT, 'manifest.json'), join(distDir, 'manifest.json'));
console.log('Copied manifest.json to dist/');