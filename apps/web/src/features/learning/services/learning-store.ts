import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { LearningDatabaseError } from '../errors/learning-errors';
import type { LearnItem, LearnPass } from '../schemas/learning-models';

type UnitRow = { readonly id: string; readonly name: string };
type ItemRow = Omit<LearnItem, 'textbookAnswers'>;
type AnswerRow = { readonly entryId: string; readonly text: string };
type EntryMatchRow = { readonly found: boolean };

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
      courseId: string,
      unitId: string,
    ) => Effect.Effect<LearnPass | undefined, LearningDatabaseError>;
    readonly introduce: (
      courseId: string,
      unitId: string,
      entryId: string,
      at: Date,
    ) => Effect.Effect<boolean, LearningDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    LearningStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const loadPass = (courseId: string, unitId: string) =>
        Effect.all(
          {
            units: sql<UnitRow>`
              select id, name from units
              where id = ${unitId} and course_id = ${courseId}
            `,
            items: sql<ItemRow>`
              select e.id as "entryId", e.target_text as "targetText",
                e.native_text as "nativeText",
                exists(
                  select 1 from entry_audio a where a.entry_id = e.id
                ) as "hasAudio"
              from entries e
              join units u on u.id = e.unit_id and u.course_id = e.course_id
              where u.id = ${unitId} and u.course_id = ${courseId}
                and exists(
                  select 1 from cards c
                  where c.entry_id = e.id and c.introduced_at is null
                )
              order by e.created_at asc, e.id asc
            `,
            answers: sql<AnswerRow>`
              select a.entry_id as "entryId", a.text
              from accepted_answers a
              join entries e on e.id = a.entry_id
              join units u on u.id = e.unit_id and u.course_id = e.course_id
              where u.id = ${unitId} and u.course_id = ${courseId}
                and a.direction = 'to_target' and a.source = 'textbook'
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
                byEntry.set(answer.entryId, [answer.text]);
              } else {
                existing.push(answer.text);
              }
            }
            return unit === undefined
              ? undefined
              : ({
                  unit,
                  items: items.map((item) => ({
                    ...item,
                    textbookAnswers: byEntry.get(item.entryId) ?? [],
                  })),
                } satisfies LearnPass);
          }),
          Effect.mapError((cause) =>
            databaseError('load learning pass', cause),
          ),
        );
      // Both directions of an entry are introduced together: the pass teaches the
      // entry, not one way of asking about it. Already introduced cards keep
      // their original timestamp, so replaying a pass costs nothing.
      const introduce = (
        courseId: string,
        unitId: string,
        entryId: string,
        at: Date,
      ) =>
        sql<EntryMatchRow>`
          with matching_entry as (
            select e.id
            from entries e
            join units u on u.id = e.unit_id and u.course_id = e.course_id
            where e.id = ${entryId} and u.id = ${unitId}
              and u.course_id = ${courseId}
          ), updated as (
            update cards set introduced_at = ${at}
            where entry_id in (select id from matching_entry)
              and introduced_at is null
            returning id
          )
          select exists(select 1 from matching_entry) as found
        `.pipe(
          Effect.map((rows) => rows[0]?.found ?? false),
          Effect.mapError((cause) => databaseError('introduce entry', cause)),
        );
      return { loadPass, introduce } as const;
    }),
  );
}
