import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Render provides the public HTTPS origin at runtime.
if (!process.env.FRONTEND_ORIGIN && process.env.RENDER_EXTERNAL_URL) {
  process.env.FRONTEND_ORIGIN = process.env.RENDER_EXTERNAL_URL;
}

const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_ORIGIN',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[start] Refusing to start. Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL.startsWith('postgres')) {
    console.error('[start] DATABASE_URL must be a PostgreSQL connection string.');
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32 || process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error('[start] JWT secrets must be at least 32 characters long.');
    process.exit(1);
  }
  if (!process.env.FRONTEND_ORIGIN.startsWith('https://')) {
    console.error('[start] FRONTEND_ORIGIN must be the public HTTPS URL in production.');
    process.exit(1);
  }
}

console.log('[start] Running production database migrations...');
const migration = spawnSync(process.execPath, [resolve(root, 'scripts/migrate.mjs')], {
  stdio: 'inherit',
  env: process.env,
});
if (migration.status !== 0) {
  console.error('[start] Database migration step failed.');
  process.exit(migration.status ?? 1);
}

const entry = resolve(root, 'apps/api/dist/main.js');
if (!existsSync(entry)) {
  console.error(`[start] Missing API build at ${entry}.`);
  process.exit(1);
}

console.log('[start] Starting MarketHub API and static frontend...');
const server = spawnSync(process.execPath, [entry], { stdio: 'inherit', env: process.env });
process.exit(server.status ?? 0);
