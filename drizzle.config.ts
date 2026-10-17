import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  // The only active migration ledger. The SQL files in supabase/legacy-migrations
  // are preserved as unapplied legacy references and are not executed.
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
