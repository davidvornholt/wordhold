import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { LearningDatabaseError } from '../errors/learning-errors';
import type { LearnItem, LearnPass } from '../schemas/learning-models';

type UnitRow = { readonly id: string; readonly name: string };
type ItemRow = Omit<LearnItem, 'textbookAnswers'>;
type AnswerRow = {
  readonly entryId: string;
  readonly direction: LearnItem['direction'];
  readonly text: string;
};
type CardMatchRow = { readonly found: boolean };

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
      cardId: string,
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
              select c.id as "cardId", c.direction,
                e.id as "entryId", e.target_text as "targetText",
                e.native_text as "nativeText",
                exists(
                  select 1 from entry_audio a where a.entry_id = e.id
                ) as "hasAudio"
              from entries e
              join units u on u.id = e.unit_id and u.course_id = e.course_id
              join courses co on co.id = e.course_id
              join cards c on c.entry_id = e.id
              where u.id = ${unitId} and u.course_id = ${courseId}
                and c.direction = any(co.directions)
                and c.introduced_at is null
              order by e.created_at asc, e.id asc, c.direction asc
            `,
            answers: sql<AnswerRow>`
              select a.entry_id as "entryId", a.direction, a.text
              from accepted_answers a
              join entries e on e.id = a.entry_id
              join units u on u.id = e.unit_id and u.course_id = e.course_id
              where u.id = ${unitId} and u.course_id = ${courseId}
                and a.source = 'textbook'
            `,
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ units, items, answers }) => {
            const unit = units.at(0);
            const byCard = new Map<string, Array<string>>();
            for (const answer of answers) {
              const key = `${answer.entryId}:${answer.direction}`;
              const existing = byCard.get(key);
              if (existing === undefined) {
                byCard.set(key, [answer.text]);
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
                    textbookAnswers:
                      byCard.get(`${item.entryId}:${item.direction}`) ?? [],
                  })),
                } satisfies LearnPass);
          }),
          Effect.mapError((cause) =>
            databaseError('load learning pass', cause),
          ),
        );
      // Introduction is card-scoped: enabling a second direction later must
      // teach that direction before regular practice can ask it.
      const introduce = (
        courseId: string,
        unitId: string,
        cardId: string,
        at: Date,
      ) =>
        sql<CardMatchRow>`
          with matching_card as (
            select c.id
            from cards c
            join entries e on e.id = c.entry_id
            join units u on u.id = e.unit_id and u.course_id = e.course_id
            join courses co on co.id = e.course_id
            where c.id = ${cardId} and u.id = ${unitId}
              and u.course_id = ${courseId}
              and c.direction = any(co.directions)
          ), updated as (
            update cards set introduced_at = ${at}
            where id in (select id from matching_card)
              and introduced_at is null
            returning id
          )
          select exists(select 1 from matching_card) as found
        `.pipe(
          Effect.map((rows) => rows[0]?.found ?? false),
          Effect.mapError((cause) => databaseError('introduce card', cause)),
        );
      return { loadPass, introduce } as const;
    }),
  );
}
