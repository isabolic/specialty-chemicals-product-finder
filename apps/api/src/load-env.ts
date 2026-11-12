import { config } from 'dotenv';
import { resolve } from 'node:path';

// Local dev convenience: one .env at the repo root. In Docker the variables
// come from the environment and no file exists, which is fine.
config({ path: resolve(__dirname, '../../../.env'), quiet: true });
