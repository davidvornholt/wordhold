import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { BibleDatabaseError } from '../errors/bible-errors';
import type { BibleSummary } from '../schemas/bible-models';
import type { BibleModule } from './mysword-module';

export type ChapterVerse = {
  readonly verse: number;
  readonly text: string;
};

export type InsertBibleResult =
  | { readonly kind: 'imported'; readonly bible: BibleSummary }
  | { readonly kind: 'conflict' };

// A chapter as one Bible has it, under the abbreviation messages name the
// Bible by.
export type FoundChapter = {
  readonly kind: 'found';
  readonly abbreviation: string;
  readonly verses: ReadonlyArray<ChapterVerse>;
};

export type ChapterResult = { readonly kind: 'bible-missing' } | FoundChapter;

// Verses are sent as JSON in batches, so a whole Bible takes a few dozen
// statements instead of thirty thousand.
const verseBatchSize = 2000;

const databaseError =
  (operation: string, message: string) => (cause: unknown) =>
    Effect.fail(new BibleDatabaseError({ operation, cause, message }));

export class BibleStore extends Context.Service<
  BibleStore,
  {
    readonly insert: (
      ownerId: string,
      module: BibleModule,
    ) => Effect.Effect<InsertBibleResult, BibleDatabaseError>;
    readonly list: (
      ownerId: string,
    ) => Effect.Effect<ReadonlyArray<BibleSummary>, BibleDatabaseError>;
    readonly chapter: (
      ownerId: string,
      bibleId: string,
      book: number,
      chapter: number,
    ) => Effect.Effect<ChapterResult, BibleDatabaseError>;
    readonly remove: (
      ownerId: string,
      bibleId: string,
    ) => Effect.Effect<boolean, BibleDatabaseError>;
  }
>()('wordhold/BibleStore') {
  static readonly live = Layer.effect(
    BibleStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      // A person has each translation once. A second upload under the same
      // abbreviation is refused by the unique index rather than merged.
      const insert = (ownerId: string, module: BibleModule) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              const [bible] = yield* sql<{ readonly id: string }>`
                insert into bibles (owner_id, name, abbreviation)
                values (${ownerId}, ${module.name}, ${module.abbreviation})
                on conflict (owner_id, abbreviation) do nothing
                returning id
              `;
              if (bible === undefined) {
                return { kind: 'conflict' } as const;
              }
              for (
                let start = 0;
                start < module.verses.length;
                start += verseBatchSize
              ) {
                const batch = module.verses.slice(
                  start,
                  start + verseBatchSize,
                );
                yield* sql`
                  insert into bible_verses (bible_id, book, chapter, verse, text)
                  select ${bible.id}, v.book, v.chapter, v.verse, v.text
                  from jsonb_to_recordset(${JSON.stringify(batch)}::jsonb)
                    as v(book smallint, chapter smallint, verse smallint, text text)
                `;
              }
              return {
                kind: 'imported',
                bible: {
                  id: bible.id,
                  name: module.name,
                  abbreviation: module.abbreviation,
                  verseCount: module.verses.length,
                },
              } as const;
            }),
          )
          .pipe(
            Effect.catchTag(
              'SqlError',
              databaseError(
                'insert bible',
                'Die Bibel konnte nicht gespeichert werden.',
              ),
            ),
          );

      const list = (ownerId: string) =>
        sql<BibleSummary>`
          select b.id, b.name, b.abbreviation,
            (select count(*)::int from bible_verses v where v.bible_id = b.id)
              as "verseCount"
          from bibles b
          where b.owner_id = ${ownerId}
          order by b.abbreviation, b.created_at
        `.pipe(
          Effect.catchTag(
            'SqlError',
            databaseError(
              'list bibles',
              'Die Bibeln konnten nicht geladen werden.',
            ),
          ),
        );

      // A whole chapter is small, so the verses of a passage are picked from
      // it, and its last verse tells how far a passage may reach.
      const chapter = (
        ownerId: string,
        bibleId: string,
        book: number,
        chapterNumber: number,
      ) =>
        Effect.gen(function* () {
          const [bible] = yield* sql<{ readonly abbreviation: string }>`
            select abbreviation from bibles
            where id = ${bibleId} and owner_id = ${ownerId}
          `;
          if (bible === undefined) {
            return { kind: 'bible-missing' } as const;
          }
          const verses = yield* sql<ChapterVerse>`
            select verse, text from bible_verses
            where bible_id = ${bibleId} and book = ${book}
              and chapter = ${chapterNumber}
            order by verse
          `;
          return {
            kind: 'found',
            abbreviation: bible.abbreviation,
            verses,
          } as const;
        }).pipe(
          Effect.catchTag(
            'SqlError',
            databaseError(
              'read chapter',
              'Die Bibelstelle konnte nicht geladen werden.',
            ),
          ),
        );

      const remove = (ownerId: string, bibleId: string) =>
        sql<{ readonly id: string }>`
          delete from bibles
          where id = ${bibleId} and owner_id = ${ownerId}
          returning id
        `.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.catchTag(
            'SqlError',
            databaseError(
              'remove bible',
              'Die Bibel konnte nicht entfernt werden.',
            ),
          ),
        );

      return { insert, list, chapter, remove } as const;
    }),
  );
}
