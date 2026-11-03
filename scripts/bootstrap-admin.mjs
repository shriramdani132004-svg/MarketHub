#!/usr/bin/env node
/**
 * One-time administrator bootstrap.
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs --url https://<service>.onrender.com \
 *     --email admin@example.com --name "MarketHub Admin"
 *
 * The password is read interactively (never passed on the command line) and the
 * one-time secret comes from ADMIN_BOOTSTRAP_SECRET in the environment.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const baseUrl = (arg('url', process.env.MARKETHUB_URL || 'http://localhost:4000')).replace(/\/$/, '');
const email = arg('email');
const name = arg('name', 'MarketHub Administrator');
const secret = process.env.ADMIN_BOOTSTRAP_SECRET;

if (!email) {
  console.error('Missing --email');
  process.exit(1);
}
if (!secret) {
  console.error('ADMIN_BOOTSTRAP_SECRET must be set in the environment');
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const password = await rl.question('Administrator password (min 10 chars, upper/lower/digit): ');
const confirm = await rl.question('Confirm password: ');
rl.close();

if (password !== confirm) {
  console.error('Passwords do not match');
  process.exit(1);
}

const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
const csrfCookie = csrfResponse.headers.get('set-cookie')?.split(';')[0] ?? '';
const csrfToken = csrfCookie.split('=')[1];

const response = await fetch(`${baseUrl}/api/v1/auth/admin/bootstrap`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-bootstrap-secret': secret,
    ...(csrfToken ? { cookie: csrfCookie, 'x-csrf-token': csrfToken } : {}),
  },
  body: JSON.stringify({ name, email, password }),
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`Bootstrap failed (${response.status}): ${body.message ?? 'unknown error'}`);
  process.exit(1);
}
console.log(`Administrator created: ${body.user?.email} (${body.user?.id})`);
console.log('Remove ADMIN_BOOTSTRAP_SECRET from the Render environment after this step.');
