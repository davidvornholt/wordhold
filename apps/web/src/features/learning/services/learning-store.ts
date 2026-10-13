import { Database } from '@wordhold/db/client';
import { translationDirections } from '@wordhold/db/schema/directions';
import { Context, Effect, Layer } from 'effect';
import { syncRelationIntroduction } from '../../../shared/practice/relation-introduction';
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
type MatchedCardRow = { readonly entryId: string };
type ChangedCardRow = { readonly id: string; readonly entryId: string };

const databaseError = (operation: string, cause: unknown) =>
  new LearningDatabaseError({
    operation,
    cause,
    message: 'Die Vokabeln konnten nicht geladen werden.',
  });

const saveError = (operation: string, cause: unknown) =>
  new LearningDatabaseError({
    operation,
    cause,
    message: 'Der Lernstand konnte nicht gespeichert werden.',
  });

// Postgres reads the ids as one array parameter.
const uuidArray = (ids: ReadonlyArray<string>) => `{${ids.join(',')}}`;

const passFromRows = (
  items: ReadonlyArray<ItemRow>,
  answers: ReadonlyArray<AnswerRow>,
): LearnSelectionPass => {
  const byCard = Map.groupBy(
    answers,
    (answer) => `${answer.entryId}:${answer.direction}`,
  );
  return {
    directions: translationDirections.flatMap((direction) => {
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
    // Only the course's translation directions are learned. A word's
    // synonym and antonym cards follow it: learning or skipping the word lets
    // them be asked, and returning it holds back those not yet answered.
    readonly introduce: (
      courseId: string,
      cardId: string,
      at: Date,
    ) => Effect.Effect<boolean, LearningDatabaseError>;
    // Both resolve to the cards they changed. Cards of another course, of a
    // direction the course does not learn, or already in the wanted state
    // are left alone.
    readonly skipLearning: (
      courseId: string,
      cardIds: ReadonlyArray<string>,
      at: Date,
    ) => Effect.Effect<ReadonlyArray<string>, LearningDatabaseError>;
    // Only a card that was never answered goes back: once it has been, its
    // schedule already brings it back as often as it is missed.
    readonly returnToLearning: (
      courseId: string,
      cardIds: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<string>, LearningDatabaseError>;
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
        sql
          .withTransaction(
            Effect.gen(function* () {
              const matched = yield* sql<MatchedCardRow>`
                with matching_card as (
                  select c.id, c.entry_id
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
                select entry_id as "entryId" from matching_card
              `;
              const entryIds = matched.map((row) => row.entryId);
              yield* syncRelationIntroduction(sql, entryIds);
              return entryIds.length > 0;
            }),
          )
          .pipe(
            Effect.mapError((cause) => databaseError('introduce card', cause)),
          );
      // The changed cards' words then ask or hold back their synonyms and
      // antonyms in the same transaction.
      const changeLearning = <E>(
        changed: Effect.Effect<ReadonlyArray<ChangedCardRow>, E>,
      ) =>
        sql.withTransaction(
          Effect.gen(function* () {
            const rows = yield* changed;
            yield* syncRelationIntroduction(
              sql,
              rows.map((row) => row.entryId),
            );
            return rows.map((row) => row.id);
          }),
        );
      const skipLearning = (
        courseId: string,
        cardIds: ReadonlyArray<string>,
        at: Date,
      ) =>
        changeLearning(sql<ChangedCardRow>`
          update cards c set introduced_at = ${at}
          from entries e, courses co
          where c.id = any(${uuidArray(cardIds)}::uuid[])
            and e.id = c.entry_id and co.id = e.course_id
            and e.course_id = ${courseId}
            and c.direction = any(co.directions)
            and c.introduced_at is null
          returning c.id, c.entry_id as "entryId"
        `).pipe(Effect.mapError((cause) => saveError('skip learning', cause)));
      const returnToLearning = (
        courseId: string,
        cardIds: ReadonlyArray<string>,
      ) =>
        changeLearning(sql<ChangedCardRow>`
          update cards c set introduced_at = null
          from entries e, courses co
          where c.id = any(${uuidArray(cardIds)}::uuid[])
            and e.id = c.entry_id and co.id = e.course_id
            and e.course_id = ${courseId}
            and c.direction = any(co.directions)
            and c.introduced_at is not null
            and c.state = 'new'
          returning c.id, c.entry_id as "entryId"
        `).pipe(
          Effect.mapError((cause) => saveError('return to learning', cause)),
        );
      return {
        loadPass,
        loadSelection,
        introduce,
        skipLearning,
        returnToLearning,
      } as const;
    }),
  );
}
