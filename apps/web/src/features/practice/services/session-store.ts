import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { PracticeDatabaseError } from '../errors/practice-errors';
import type { PracticeItem } from '../schemas/practice-models';

const newCardsPerSession = 10;

type ItemRow = Omit<PracticeItem, 'prompt'>;

export class PracticeSessionStore extends Context.Tag(
  'wordhold/PracticeSessionStore',
)<
  PracticeSessionStore,
  {
    readonly load: (
      courseId: string,
      now: Date,
    ) => Effect.Effect<
      {
        readonly due: ReadonlyArray<ItemRow>;
        readonly fresh: ReadonlyArray<ItemRow>;
      },
      PracticeDatabaseError
    >;
  }
>() {
  static readonly live = Layer.effect(
    PracticeSessionStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const load = (courseId: string, now: Date) =>
        Effect.all(
          {
            due: sql<ItemRow>`
              select c.id as "cardId", c.revision, c.direction,
                e.id as "entryId", e.type as "entryType",
                e.target_text as "targetText", e.native_text as "nativeText",
                exists(select 1 from entry_audio a where a.entry_id = e.id) as "hasAudio"
              from cards c
              join entries e on e.id = c.entry_id
              where e.course_id = ${courseId}
                and c.state <> 'new'
                and c.due_at is not null
                and c.due_at <= ${now}
              order by c.due_at asc
            `,
            fresh: sql<ItemRow>`
              select c.id as "cardId", c.revision, c.direction,
                e.id as "entryId", e.type as "entryType",
                e.target_text as "targetText", e.native_text as "nativeText",
                exists(select 1 from entry_audio a where a.entry_id = e.id) as "hasAudio"
              from cards c
              join entries e on e.id = c.entry_id
              where e.course_id = ${courseId} and c.state = 'new'
              order by e.created_at asc, c.direction asc
              limit ${newCardsPerSession}
            `,
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.mapError(
            (cause) =>
              new PracticeDatabaseError({
                operation: 'load practice session',
                cause,
                message: 'Die Übung konnte nicht geladen werden.',
              }),
          ),
        );
      return { load } as const;
    }),
  );
}
