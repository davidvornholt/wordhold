import { Database } from '@wordhold/db/client';
import { answerDirections } from '@wordhold/db/schema/directions';
import { Context, Effect, Layer } from 'effect';
import { sessionSectionSize } from '../../../shared/session/section-policy';
import {
  type PlaceSelectionData,
  selectedEntries,
  type VocabularySelectionData,
} from '../../../shared/session/vocabulary-selection';
import { LearningDatabaseError } from '../errors/learning-errors';
import type {
  LearnItem,
  LearnPass,
  LearnSelectionPass,
} from '../schemas/learning-models';

type PlaceRow = { readonly name: string };
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
      targetText: item.targetText,
      nativeText: item.nativeText,
      hasAudio: item.hasAudio,
      example: null,
      keyPoints: item.keyPoints,
      textbookAnswers:
        byCard
          .get(`${item.entryId}:${item.direction}`)
          ?.map((answer) => answer.text) ?? [],
    })),
  };
};

export class LearningStore extends Context.Service<
  LearningStore,
  {
    // A null place covers the whole course, as a subject's list does.
    readonly loadPass: (
      courseId: string,
      place: PlaceSelectionData | null,
    ) => Effect.Effect<LearnPass | undefined, LearningDatabaseError>;
    readonly loadSelection: (
      courseId: string,
      selection: VocabularySelectionData,
    ) => Effect.Effect<LearnSelectionPass, LearningDatabaseError>;
    readonly introduce: (
      courseId: string,
      cardId: string,
      at: Date,
    ) => Effect.Effect<boolean, LearningDatabaseError>;
  }
>()('wordhold/LearningStore') {
  static readonly live = Layer.effect(
    LearningStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const loadSelectionRows = (
        courseId: string,
        selection: VocabularySelectionData | null,
      ) => {
        const selected =
          selection === null ? sql`true` : selectedEntries(sql, selection);
        return Effect.all(
          {
            items: sql<ItemRow>`
              select "cardId", direction, "entryId", "targetText",
                "nativeText", "keyPoints", "hasAudio", "directionTotal"
              from (
                select c.id as "cardId", c.direction,
                  e.id as "entryId",
                  e.target_text as "targetText",
                  e.native_text as "nativeText",
                  e.key_points as "keyPoints",
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
      const placeName = (
        courseId: string,
        place: PlaceSelectionData | null,
      ) => {
        if (place === null) {
          return sql<PlaceRow>`select name from courses where id = ${courseId}`;
        }
        return 'bookId' in place
          ? sql<PlaceRow>`
              select name from books
              where id = ${place.bookId} and course_id = ${courseId}
            `
          : sql<PlaceRow>`
              select name from units
              where id = ${place.unitId} and course_id = ${courseId}
            `;
      };
      const loadPass = (courseId: string, place: PlaceSelectionData | null) =>
        Effect.all(
          {
            places: placeName(courseId, place),
            pass: loadSelectionRows(courseId, place),
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ places, pass }) => {
            const found = places.at(0);
            return found === undefined
              ? undefined
              : { ...pass, name: found.name };
          }),
          Effect.mapError((cause) =>
            databaseError('load learning pass', cause),
          ),
        );
      const introduce = (courseId: string, cardId: string, at: Date) =>
        sql<CardMatchRow>`
          with matching_card as (
            select c.id
            from cards c
            join entries e on e.id = c.entry_id
            join courses co on co.id = e.course_id
            where c.id = ${cardId} and e.course_id = ${courseId}
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
