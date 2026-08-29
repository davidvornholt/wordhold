import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { PracticeDatabaseError } from '../errors/practice-errors';
import type { PracticeItem } from '../schemas/practice-models';
import type { SessionDirection } from '../schemas/session-request';

const newCardsPerSession = 10;

// Every query below requires `introduced_at`: a card is only asked once the
// entry behind it has been through the learning pass. Asking about an entry the
// learner has never seen produces a failure that says nothing about memory,
// and FSRS would schedule the entry on that failure.
//
// They all require the direction to be one the course still practises
// (`co.directions`) as well as the one picked for this sitting. "Both" is
// passed as null, which the null check in each query turns into "no extra
// restriction"; the casts keep Postgres from having to guess the parameter's
// type when it is null.

type ItemRow = Omit<PracticeItem, 'prompt'>;

const chosenDirection = (direction: SessionDirection) =>
  direction === 'both' ? null : direction;

export class PracticeSessionStore extends Context.Tag(
  'wordhold/PracticeSessionStore',
)<
  PracticeSessionStore,
  {
    readonly load: (
      courseId: string,
      direction: SessionDirection,
      now: Date,
    ) => Effect.Effect<
      {
        readonly due: ReadonlyArray<ItemRow>;
        readonly fresh: ReadonlyArray<ItemRow>;
      },
      PracticeDatabaseError
    >;
    // Every learned card of one unit, due or not. Drilling is deliberate, so
    // it does not ask what the schedule wants.
    readonly loadUnit: (
      unitId: string,
      direction: SessionDirection,
    ) => Effect.Effect<ReadonlyArray<ItemRow>, PracticeDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    PracticeSessionStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const load = (
        courseId: string,
        direction: SessionDirection,
        now: Date,
      ) => {
        const only = chosenDirection(direction);
        return Effect.all(
          {
            due: sql<ItemRow>`
              select c.id as "cardId", c.revision, c.direction,
                e.id as "entryId",
                e.target_text as "targetText", e.native_text as "nativeText",
                exists(select 1 from entry_audio a where a.entry_id = e.id) as "hasAudio"
              from cards c
              join entries e on e.id = c.entry_id
              join courses co on co.id = e.course_id
              where e.course_id = ${courseId}
                and c.introduced_at is not null
                and c.direction = any(co.directions)
                and (${only}::answer_direction is null
                  or c.direction = ${only}::answer_direction)
                and c.state <> 'new'
                and c.due_at is not null
                and c.due_at <= ${now}
              order by c.due_at asc
            `,
            fresh: sql<ItemRow>`
              select c.id as "cardId", c.revision, c.direction,
                e.id as "entryId",
                e.target_text as "targetText", e.native_text as "nativeText",
                exists(select 1 from entry_audio a where a.entry_id = e.id) as "hasAudio"
              from cards c
              join entries e on e.id = c.entry_id
              join courses co on co.id = e.course_id
              where e.course_id = ${courseId}
                and c.introduced_at is not null
                and c.direction = any(co.directions)
                and (${only}::answer_direction is null
                  or c.direction = ${only}::answer_direction)
                and c.state = 'new'
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
      };
      const loadUnit = (unitId: string, direction: SessionDirection) => {
        const only = chosenDirection(direction);
        return sql<ItemRow>`
          select c.id as "cardId", c.revision, c.direction,
            e.id as "entryId",
            e.target_text as "targetText", e.native_text as "nativeText",
            exists(select 1 from entry_audio a where a.entry_id = e.id) as "hasAudio"
          from cards c
          join entries e on e.id = c.entry_id
          join courses co on co.id = e.course_id
          where e.unit_id = ${unitId}
            and c.introduced_at is not null
            and c.direction = any(co.directions)
            and (${only}::answer_direction is null
              or c.direction = ${only}::answer_direction)
          order by c.due_at asc nulls last, e.created_at asc, c.direction asc
        `.pipe(
          Effect.mapError(
            (cause) =>
              new PracticeDatabaseError({
                operation: 'load unit drill',
                cause,
                message: 'Die Einheit konnte nicht geladen werden.',
              }),
          ),
        );
      };
      return { load, loadUnit } as const;
    }),
  );
}
