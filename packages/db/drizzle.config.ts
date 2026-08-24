import process from 'node:process';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema/auth.ts',
    './src/schema/courses.ts',
    './src/schema/pages.ts',
    './src/schema/entries.ts',
    './src/schema/practice.ts',
  ],
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
