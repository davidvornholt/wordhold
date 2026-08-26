import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { LearningDatabaseError } from '../errors/learning-errors';
import type { LearnItem, LearnPass } from '../schemas/learning-models';

type UnitRow = { readonly id: string; readonly name: string };
type ItemRow = Omit<LearnItem, 'acceptedNormalized'>;
type AnswerRow = { readonly entryId: string; readonly normalized: string };

const databaseError = (operation: string, cause: unknown) =>
  new LearningDatabaseError({
    operation,
    cause,
    message: 'Die Einheit konnte nicht geladen werden.',
  });

export class LearningStore extends Context.Tag('wordhold/LearningStore')<
  LearningStore,
  {
    readonly loadPass: (
      unitId: string,
    ) => Effect.Effect<LearnPass | undefined, LearningDatabaseError>;
    readonly introduce: (
      entryId: string,
      at: Date,
    ) => Effect.Effect<void, LearningDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    LearningStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const loadPass = (unitId: string) =>
        Effect.all(
          {
            units: sql<UnitRow>`
              select id, name from units where id = ${unitId}
            `,
            items: sql<ItemRow>`
              select e.id as "entryId", e.target_text as "targetText",
                e.native_text as "nativeText",
                exists(
                  select 1 from entry_audio a where a.entry_id = e.id
                ) as "hasAudio"
              from entries e
              where e.unit_id = ${unitId}
                and exists(
                  select 1 from cards c
                  where c.entry_id = e.id and c.introduced_at is null
                )
              order by e.created_at asc, e.id asc
            `,
            // The learner types the target text, so only that direction's
            // accepted answers can match. They are fetched as rows rather than
            // aggregated in SQL because a Postgres array would arrive shaped
            // by the driver rather than by this query.
            answers: sql<AnswerRow>`
              select a.entry_id as "entryId", a.normalized
              from accepted_answers a
              join entries e on e.id = a.entry_id
              where e.unit_id = ${unitId} and a.direction = 'to_target'
            `,
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ units, items, answers }) => {
            const unit = units.at(0);
            const byEntry = new Map<string, Array<string>>();
            for (const answer of answers) {
              const existing = byEntry.get(answer.entryId);
              if (existing === undefined) {
                byEntry.set(answer.entryId, [answer.normalized]);
              } else {
                existing.push(answer.normalized);
              }
            }
            return unit === undefined
              ? undefined
              : ({
                  unit,
                  items: items.map((item) => ({
                    ...item,
                    acceptedNormalized: byEntry.get(item.entryId) ?? [],
                  })),
                } satisfies LearnPass);
          }),
          Effect.mapError((cause) =>
            databaseError('load learning pass', cause),
          ),
        );
      // Both directions of a word are introduced together: the pass teaches the
      // word, not one way of asking about it. Already introduced cards keep
      // their original timestamp, so replaying a pass costs nothing.
      const introduce = (entryId: string, at: Date) =>
        sql`
          update cards set introduced_at = ${at}
          where entry_id = ${entryId} and introduced_at is null
        `.pipe(
          Effect.asVoid,
          Effect.mapError((cause) => databaseError('introduce word', cause)),
        );
      return { loadPass, introduce } as const;
    }),
  );
}
