import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { testDatabaseUrl } from './test-db';

/** Bring the test database to the latest migration before any suite runs. */
export default function globalSetup(): void {
  execFileSync(resolve(__dirname, '../node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
  });
}
