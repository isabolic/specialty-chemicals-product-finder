import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env'), quiet: true });

// Captured once at load time: tests later point DATABASE_URL at the test
// database, and the guard must still compare against the real dev database.
const devDatabaseUrl = process.env.DATABASE_URL;

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  if (url === devDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL; tests truncate tables.');
  }
  return url;
}
