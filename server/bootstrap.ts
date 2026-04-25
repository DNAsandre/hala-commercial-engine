/**
 * Server bootstrap — loads environment variables BEFORE anything else.
 * This file is the actual entry point. It loads .env, then starts the app.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

// Now that env is loaded, import and start the app
await import('./index.js');
