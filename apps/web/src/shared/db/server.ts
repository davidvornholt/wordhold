import { makeDrizzle } from '@wordhold/db/drizzle';
import { serverEnv } from '../env/server';

// One connection pool for the whole server; postgres-js connects lazily.
export const db = makeDrizzle(serverEnv.databaseUrl());
