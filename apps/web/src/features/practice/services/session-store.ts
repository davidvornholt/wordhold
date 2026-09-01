import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { readyCardsInNextSection } from '../../../shared/practice/session-policy';
import { sessionSectionSize } from '../../../shared/session/section-policy';
import { PracticeDatabaseError } from '../errors/practice-errors';
import type { PracticeItem } from '../schemas/practice-models';
import type {
  SessionDirection,
  StudyRequestData,
} from '../schemas/session-request';

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

type ItemRow = Omit<PracticeItem, 'example' | 'prompt'>;

type AvailabilityRow = {
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
};

const chosenDirection = (direction: SessionDirection) =>
  direction === 'both' ? null : direction;

export class PracticeSessionStore extends Context.Tag(
  'wordhold/PracticeSessionStore',
)<
  PracticeSessionStore,
  {
    readonly loadScheduled: (
      courseId: string,
      direction: SessionDirection,
      unitId: string | null,
      now: Date,
    ) => Effect.Effect<
      {
        readonly items: ReadonlyArray<ItemRow>;
        readonly availability: {
          readonly due: number;
          readonly firstReviews: number;
          readonly ready: number;
          readonly nextDueAt: Date | null;
        };
      },
      PracticeDatabaseError
    >;
    readonly loadSelection: (
      request: StudyRequestData,
    ) => Effect.Effect<ReadonlyArray<ItemRow>, PracticeDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    PracticeSessionStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const loadScheduled = (
        courseId: string,
        direction: SessionDirection,
        unitId: string | null,
        now: Date,
      ) => {
        const only = chosenDirection(direction);
        return Effect.all(
          {
            items: sql<ItemRow>`
              select c.id as "cardId", c.revision, c.direction,
                e.id as "entryId",
                e.target_text as "targetText", e.native_text as "nativeText",
                exists(select 1 from entry_audio a where a.entry_id = e.id) as "hasAudio"
              from cards c
              join entries e on e.id = c.entry_id
              join courses co on co.id = e.course_id
              where e.course_id = ${courseId}
                and (${unitId}::uuid is null or e.unit_id = ${unitId}::uuid)
                and c.introduced_at is not null
                and c.direction = any(co.directions)
                and (${only}::answer_direction is null
                  or c.direction = ${only}::answer_direction)
                and (
                  c.state = 'new'
                  or (c.due_at is not null and c.due_at <= ${now})
                )
              order by (c.state = 'new') asc, c.due_at asc nulls last,
                e.created_at asc, c.direction asc
              limit ${sessionSectionSize}
            `,
            availability: sql<AvailabilityRow>`
              select
                count(*) filter (
                  where c.state <> 'new' and c.due_at is not null
                    and c.due_at <= ${now}
                )::int as due,
                count(*) filter (where c.state = 'new')::int as "firstReviews",
                min(c.due_at) filter (where c.due_at > ${now}) as "nextDueAt"
              from cards c
              join entries e on e.id = c.entry_id
              join courses co on co.id = e.course_id
              where e.course_id = ${courseId}
                and (${unitId}::uuid is null or e.unit_id = ${unitId}::uuid)
                and c.introduced_at is not null
                and c.direction = any(co.directions)
                and (${only}::answer_direction is null
                  or c.direction = ${only}::answer_direction)
              group by e.course_id
            `,
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ items, availability }) => {
            const counts = availability.at(0) ?? {
              due: 0,
              firstReviews: 0,
              nextDueAt: null,
            };
            return {
              items,
              availability: {
                ...counts,
                ready: readyCardsInNextSection(counts.due, counts.firstReviews),
              },
            };
          }),
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
      const loadSelection = ({
        courseId,
        direction,
        selection,
      }: StudyRequestData) => {
        const only = chosenDirection(direction);
        const selectionClause =
          'unitId' in selection
            ? sql`e.unit_id = ${selection.unitId}`
            : sql`e.id = any(${`{${selection.entryIds.join(',')}}`}::uuid[])`;
        return sql<ItemRow>`
          select c.id as "cardId", c.revision, c.direction,
            e.id as "entryId",
            e.target_text as "targetText", e.native_text as "nativeText",
            exists(select 1 from entry_audio a where a.entry_id = e.id) as "hasAudio"
          from cards c
          join entries e on e.id = c.entry_id
          where e.course_id = ${courseId}
            and ${selectionClause}
            and (${only}::answer_direction is null
              or c.direction = ${only}::answer_direction)
          order by c.due_at asc nulls last, e.created_at asc, c.direction asc
        `.pipe(
          Effect.mapError(
            (cause) =>
              new PracticeDatabaseError({
                operation: 'load selected practice',
                cause,
                message:
                  'Die ausgewählten Vokabeln konnten nicht geladen werden.',
              }),
          ),
        );
      };
      return { loadScheduled, loadSelection } as const;
    }),
  );
}
