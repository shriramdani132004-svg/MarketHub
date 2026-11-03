import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'apps/web/out');
const target = resolve(root, 'apps/api/public');

if (!existsSync(source)) {
  console.error(`[copy-web] Missing static export at ${source}. Run the web build first.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`[copy-web] Copied static export to ${target}`);
