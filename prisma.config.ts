import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations and database commands use the direct connection. `prisma
// generate` does not connect, so a placeholder keeps client generation
// working in CI and at build time when no database is configured.
const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  'postgresql://localhost:5432/markethub';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
});
