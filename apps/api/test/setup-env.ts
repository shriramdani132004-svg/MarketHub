import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

/**
 * Test environment bootstrap.
 *
 * - Loads the workspace .env for normal local settings (JWT secrets, etc.).
 * - Loads .env.test (gitignored) and maps TEST_DATABASE_URL / TEST_DIRECT_URL
 *   onto DATABASE_URL / DIRECT_URL so DB-backed suites never touch the
 *   production branch, even when .env points at it.
 * - Existing process env always wins, so CI can inject secrets directly.
 * - When no dedicated test database is available, DATABASE_URL is removed so
 *   DB-backed suites skip instead of accidentally hitting .env's database.
 */
const workspaceRoot = path.resolve(__dirname, '../../..');

// Capture an explicitly provided connection string before dotenv can add the
// production one from .env. Only an explicit value counts as test-safe.
const explicitDatabaseUrl = process.env.DATABASE_URL;
const explicitDirectUrl = process.env.DIRECT_URL;
const explicitTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const explicitTestDirectUrl = process.env.TEST_DIRECT_URL;

if (existsSync(path.join(workspaceRoot, '.env'))) {
  loadEnv({ path: path.join(workspaceRoot, '.env') });
}
if (existsSync(path.join(workspaceRoot, '.env.test'))) {
  loadEnv({ path: path.join(workspaceRoot, '.env.test') });
}

const testDatabaseUrl =
  explicitTestDatabaseUrl ?? process.env.TEST_DATABASE_URL ?? explicitDatabaseUrl;
const testDirectUrl =
  explicitTestDirectUrl ?? process.env.TEST_DIRECT_URL ?? explicitDirectUrl;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DIRECT_URL = testDirectUrl ?? testDatabaseUrl;
  process.env.MARKETHUB_TEST_DATABASE = '1';
} else {
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.MARKETHUB_TEST_DATABASE;
}

process.env.NODE_ENV = 'test';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE ?? 'false';
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:4000';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-only-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-only-refresh-secret-at-least-32-characters-long';
