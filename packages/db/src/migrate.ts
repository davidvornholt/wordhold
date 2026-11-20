import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Effect, Schema } from 'effect';
import { makeDrizzle } from './drizzle';
import { type ReplayedReview, replayReviews } from './fsrs';

export const migrationsFolder = `${import.meta.dir}/../drizzle`;

export class DatabaseMigrationError extends Schema.TaggedError<DatabaseMigrationError>()(
  'DatabaseMigrationError',
  { message: Schema.String },
) {}

const migrationError = () =>
  new DatabaseMigrationError({
    message: 'Could not apply the Wordhold database migrations.',
  });

const backfillImportExpectedCounts = (
  database: ReturnType<typeof makeDrizzle>,
) =>
  Effect.tryPromise({
    try: async () => {
      const columns = await database.execute<{ readonly present: number }>(sql`
        select 1 as present
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'pages'
          and column_name = 'import_expected_count'
        limit 1
      `);
      if (columns.length === 0) {
        return;
      }
      await database.execute(sql`
        update pages as page
        set import_expected_count = counts.page_count
        from (
          select import_session_id,
            greatest(count(*)::integer, max(import_position) + 1)::integer as page_count
          from pages
          group by import_session_id
        ) as counts
        where page.import_session_id = counts.import_session_id
          and page.import_expected_count = 1
          and counts.page_count > 1
      `);
    },
    catch: migrationError,
  });

const validateImportPositionConstraint = (
  database: ReturnType<typeof makeDrizzle>,
) =>
  Effect.tryPromise({
    try: () =>
      database.execute(
        sql`alter table pages validate constraint pages_import_position_within_expected_count`,
      ),
    catch: migrationError,
  });

// Units created before books existed are filed into one book per course. The
// book gets a placeholder name the learner renames on the course page. Safe
// to rerun: it only touches units without a book.
export const placeholderBookName = 'Buch 1';

const fileUnitsIntoBooks = (database: ReturnType<typeof makeDrizzle>) =>
  Effect.tryPromise({
    try: () =>
      database.transaction(async (transaction) => {
        await transaction.execute(sql`
          insert into books (course_id, name, position)
          select distinct unit.course_id, ${placeholderBookName}, 0
          from units as unit
          where unit.book_id is null
            and not exists (
              select 1 from books as book where book.course_id = unit.course_id
            )
        `);
        await transaction.execute(sql`
          update units as unit
          set book_id = (
            select book.id
            from books as book
            where book.course_id = unit.course_id
            order by book.position, book.id
            limit 1
          )
          where unit.book_id is null
        `);
      }),
    catch: migrationError,
  });

// Runs after units are filed, so every unit already has its book.
const fileEntriesIntoBooks = (database: ReturnType<typeof makeDrizzle>) =>
  Effect.tryPromise({
    try: () =>
      database.execute(sql`
        update entries as entry
        set book_id = unit.book_id
        from units as unit
        where entry.book_id is null
          and unit.id = entry.unit_id
          and unit.book_id is not null
      `),
    catch: migrationError,
  });

// Synonym and antonym cards have no learning pass of their own: the app asks
// them once their word is learned or skipped in a translation direction, and
// holds back the unanswered ones while it is not. Cards from before that rule
// are brought in line with it here. Safe to rerun: it only touches cards out
// of step with their word.
const alignRelationCardsWithTheirWords = (
  database: ReturnType<typeof makeDrizzle>,
) =>
  Effect.tryPromise({
    try: () =>
      database.transaction(async (transaction) => {
        await transaction.execute(sql`
          update cards as relation
          set introduced_at = met.introduced_at
          from (
            select entry_id, min(introduced_at) as introduced_at
            from cards
            where direction in ('to_target', 'to_native')
              and introduced_at is not null
            group by entry_id
          ) as met
          where relation.entry_id = met.entry_id
            and relation.direction in ('to_synonym', 'to_antonym')
            and relation.introduced_at is null
        `);
        await transaction.execute(sql`
          update cards as relation
          set introduced_at = null
          where relation.direction in ('to_synonym', 'to_antonym')
            and relation.introduced_at is not null
            and relation.state = 'new'
            and not exists (
              select 1 from cards as translation
              where translation.entry_id = relation.entry_id
                and translation.direction in ('to_target', 'to_native')
                and translation.introduced_at is not null
            )
        `);
      }),
    catch: migrationError,
  });

// Cards scheduled before FSRS-7 have no short-term stability, and their
// FSRS-6 stability and difficulty mean something else under FSRS-7. Every
// answer is in `reviews`, so each such card is rebuilt from its answers as if
// FSRS-7 had always scheduled it, due date included. Safe to rerun: rebuilt
// cards have their short-term stability.
type CardAnswers = {
  readonly cardId: string;
  readonly answers: ReadonlyArray<{
    readonly reviewedAt: string;
    readonly rating: ReplayedReview['rating'];
  }>;
};

const rebuildSchedule = (
  { cardId, answers }: CardAnswers,
  timeZone: string,
) => {
  const schedule = replayReviews(
    answers.map((answer) => ({
      reviewedAt: new Date(answer.reviewedAt),
      rating: answer.rating,
    })),
    timeZone,
  );
  if (schedule.stability === null) {
    throw new Error(`Card ${cardId} has a schedule but no answers.`);
  }
  return { id: cardId, ...schedule };
};

const rescheduleCardsWithFsrs7 = (
  database: ReturnType<typeof makeDrizzle>,
  timeZone: string,
) =>
  Effect.tryPromise({
    try: () =>
      database.transaction(async (transaction) => {
        // The previous app version keeps answering during a deploy, and it
        // writes an answer and its card in one transaction guarded by the
        // card's revision. Locking the cards first lets an answer in flight
        // commit before their answers are read, and makes a later answer
        // wait and then fail its revision check. The answers are read by a
        // second statement because a statement sees only what was committed
        // when it started, not what committed while it waited for a lock.
        // It reads only the locked cards: a card first answered after the
        // lock is not locked, so a rebuild could overwrite its next answer.
        const locked = await transaction.execute<{ readonly id: string }>(sql`
          select id from cards
          where stability is not null and stability_fast is null
          for update
        `);
        if (locked.length === 0) {
          return;
        }
        const lockedIds = JSON.stringify(locked.map((card) => card.id));
        const cards = await transaction.execute<CardAnswers>(sql`
          select card.id as "cardId",
            coalesce(
              jsonb_agg(
                jsonb_build_object('reviewedAt', review.reviewed_at, 'rating', review.rating)
                order by review.reviewed_at, review.id
              ) filter (where review.id is not null),
              '[]'::jsonb
            ) as answers
          from cards as card
          left join reviews as review on review.card_id = card.id
          where card.id in (
            select value::uuid from jsonb_array_elements_text(${lockedIds}::jsonb)
          )
          group by card.id
        `);
        const schedules = cards.map((card) => rebuildSchedule(card, timeZone));
        await transaction.execute(sql`
          update cards as card set
            state = v.state,
            due_at = v."dueAt",
            stability = v.stability,
            stability_fast = v."stabilityFast",
            difficulty = v.difficulty,
            reps = v.reps,
            lapses = v.lapses,
            scheduled_days = v."scheduledDays",
            learning_steps = v."learningSteps",
            last_reviewed_at = v."lastReviewedAt",
            revision = card.revision + 1
          from jsonb_to_recordset(${JSON.stringify(schedules)}::jsonb) as v(
            id uuid, state card_state, "dueAt" timestamptz,
            stability double precision, "stabilityFast" double precision,
            difficulty double precision, reps integer, lapses integer,
            "scheduledDays" double precision, "learningSteps" integer,
            "lastReviewedAt" timestamptz
          )
          where card.id = v.id
        `);
      }),
    catch: migrationError,
  });

// Cards scheduled before due dates fell on the start of a day kept the
// minute FSRS-7 gave them, such as 00:15. A card due on a later day than its
// last answer now starts that day in the owner's zone, the rule `applyRating`
// follows. It runs on every deploy, so a card the previous app version
// answers during one is moved by the next. Safe to rerun: a card due at the
// start of its day stays there.
const startDueDaysAtMidnight = (
  database: ReturnType<typeof makeDrizzle>,
  timeZone: string,
) =>
  Effect.tryPromise({
    try: () =>
      database.execute(sql`
        update cards
        set due_at = date_trunc('day', due_at at time zone ${timeZone}) at time zone ${timeZone}
        where (due_at at time zone ${timeZone})::date
            > (last_reviewed_at at time zone ${timeZone})::date
          and due_at
            <> date_trunc('day', due_at at time zone ${timeZone}) at time zone ${timeZone}
      `),
    catch: migrationError,
  });

// `timeZone` is the owner's IANA zone, which due dates start their days in.
export const migrateDatabase = ({
  url,
  timeZone,
}: {
  readonly url: string;
  readonly timeZone: string;
}) =>
  Effect.acquireUseRelease(
    Effect.try({
      try: () => makeDrizzle(url),
      catch: migrationError,
    }),
    (database) =>
      backfillImportExpectedCounts(database).pipe(
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () => migrate(database, { migrationsFolder }),
            catch: migrationError,
          }),
        ),
        Effect.flatMap(() => backfillImportExpectedCounts(database)),
        Effect.flatMap(() => validateImportPositionConstraint(database)),
        Effect.flatMap(() => fileUnitsIntoBooks(database)),
        Effect.flatMap(() => fileEntriesIntoBooks(database)),
        Effect.flatMap(() => alignRelationCardsWithTheirWords(database)),
        Effect.flatMap(() => rescheduleCardsWithFsrs7(database, timeZone)),
        Effect.flatMap(() => startDueDaysAtMidnight(database, timeZone)),
      ),
    (database) => Effect.promise(() => database.$client.end()),
  );
