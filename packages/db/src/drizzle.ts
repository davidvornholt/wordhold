import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from './schema/auth';
import { courses } from './schema/courses';
import {
  acceptedAnswers,
  entries,
  entryAudio,
  entryExamples,
} from './schema/entries';
import { pages } from './schema/pages';
import { cards, judgeCache, reviews } from './schema/practice';
import { units } from './schema/units';

export const schema = {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
  courses,
  pages,
  units,
  entries,
  entryExamples,
  acceptedAnswers,
  entryAudio,
  cards,
  reviews,
  judgeCache,
} as const;

// Plain drizzle client for consumers that need one outside the Effect runtime
// (better-auth's adapter). Effect code uses PgLive from ./client instead.
export const makeDrizzle = (url: string) => drizzle(postgres(url), { schema });
