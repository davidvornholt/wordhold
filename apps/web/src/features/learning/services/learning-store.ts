import { Database } from '@wordhold/db/client';
import { answerDirections } from '@wordhold/db/schema/directions';
import { Context, Effect, Layer } from 'effect';
import { sessionSectionSize } from '../../../shared/session/section-policy';
import type { VocabularySelectionData } from '../../../shared/session/vocabulary-selection';
import { LearningDatabaseError } from '../errors/learning-errors';
import type {
  LearnItem,
  LearnPass,
  LearnSelectionPass,
} from '../schemas/learning-models';

type UnitRow = { readonly id: string; readonly name: string };
type ItemRow = Omit<LearnItem, 'example' | 'textbookAnswers'> & {
  readonly directionTotal: number;
};
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
    message: 'Die Vokabeln konnten nicht geladen werden.',
  });

const passFromRows = (
  items: ReadonlyArray<ItemRow>,
  answers: ReadonlyArray<AnswerRow>,
): LearnSelectionPass => {
  const byCard = Map.groupBy(
    answers,
    (answer) => `${answer.entryId}:${answer.direction}`,
  );
  return {
    directions: answerDirections.flatMap((direction) => {
      const first = items.find((item) => item.direction === direction);
      return first === undefined
        ? []
        : [{ direction, unintroduced: first.directionTotal }];
    }),
    items: items.map((item) => ({
      cardId: item.cardId,
      direction: item.direction,
      entryId: item.entryId,
      unitId: item.unitId,
      targetText: item.targetText,
      nativeText: item.nativeText,
      hasAudio: item.hasAudio,
      example: null,
      textbookAnswers:
        byCard
          .get(`${item.entryId}:${item.direction}`)
          ?.map((answer) => answer.text) ?? [],
    })),
  };
};

export class LearningStore extends Context.Tag('wordhold/LearningStore')<
  LearningStore,
  {
    readonly loadPass: (
      courseId: string,
      unitId: string,
    ) => Effect.Effect<LearnPass | undefined, LearningDatabaseError>;
    readonly loadSelection: (
      courseId: string,
      selection: VocabularySelectionData,
    ) => Effect.Effect<LearnSelectionPass, LearningDatabaseError>;
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
      const loadSelectionRows = (
        courseId: string,
        selection: VocabularySelectionData,
      ) => {
        const selected =
          'unitId' in selection
            ? sql`e.unit_id = ${selection.unitId}`
            : sql`e.id = any(${`{${selection.entryIds.join(',')}}`}::uuid[])`;
        return Effect.all(
          {
            items: sql<ItemRow>`
              select "cardId", direction, "entryId", "unitId", "targetText",
                "nativeText", "hasAudio", "directionTotal"
              from (
                select c.id as "cardId", c.direction,
                  e.id as "entryId", e.unit_id as "unitId",
                  e.target_text as "targetText",
                  e.native_text as "nativeText",
                  exists(
                    select 1 from entry_audio a where a.entry_id = e.id
                  ) as "hasAudio",
                  count(*) over (partition by c.direction)::int
                    as "directionTotal",
                  row_number() over (
                    partition by c.direction
                    order by e.created_at asc, e.id asc
                  ) as "sectionPosition"
                from entries e
                join courses co on co.id = e.course_id
                join cards c on c.entry_id = e.id
                where e.course_id = ${courseId} and ${selected}
                  and c.direction = any(co.directions)
                  and c.introduced_at is null
              ) section
              where "sectionPosition" <= ${sessionSectionSize}
              order by "sectionPosition" asc, direction asc
            `,
            answers: sql<AnswerRow>`
              select a.entry_id as "entryId", a.direction, a.text
              from accepted_answers a
              join entries e on e.id = a.entry_id
              where e.course_id = ${courseId} and ${selected}
                and a.source = 'textbook'
            `,
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ items, answers }) => passFromRows(items, answers)),
        );
      };
      const loadSelection = (
        courseId: string,
        selection: VocabularySelectionData,
      ) =>
        loadSelectionRows(courseId, selection).pipe(
          Effect.mapError((cause) =>
            databaseError('load selected learning pass', cause),
          ),
        );
      const loadPass = (courseId: string, unitId: string) =>
        Effect.all(
          {
            units: sql<UnitRow>`
              select id, name from units
              where id = ${unitId} and course_id = ${courseId}
            `,
            pass: loadSelectionRows(courseId, { unitId }),
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ units, pass }) => {
            const unit = units.at(0);
            return unit === undefined ? undefined : { ...pass, unit };
          }),
          Effect.mapError((cause) =>
            databaseError('load learning pass', cause),
          ),
        );
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
      return { loadPass, loadSelection, introduce } as const;
    }),
  );
}
