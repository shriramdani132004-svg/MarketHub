import { spawnSync } from 'node:child_process';

const required = ['DATABASE_URL', 'DIRECT_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[migrate] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('[migrate] Applying Prisma migrations with the direct database connection...');
const result = spawnSync('npx', ['--no-install', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error('[migrate] Prisma migrations failed. Refusing to start the application.');
  process.exit(result.status ?? 1);
}
console.log('[migrate] Migrations applied successfully.');
