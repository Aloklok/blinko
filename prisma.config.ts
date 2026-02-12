import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Robust loading of .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DIRECT_URL = process.env.DIRECT_URL;

if (!DIRECT_URL) {
    console.warn("WARNING: DIRECT_URL is not defined in .env! TypedSQL generation might fail.");
} else {
    console.log(`Using DIRECT_URL for generation: ${DIRECT_URL.split('@')[1]}`); // Log host for verification
}

export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL,
        directUrl: process.env.DIRECT_URL,
    },
});
