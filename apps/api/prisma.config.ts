import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The single .env lives at the repo root; a local apps/api/.env (if any) wins.
loadEnv({ path: '../../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
