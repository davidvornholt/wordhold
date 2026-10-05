import { afterAll, describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { seedOwner } from '../../../shared/testing/owner-fixture';
import { BibleService } from './bible-service';
import { BibleStore } from './bible-store';
import {
  luther1912Psalm23,
  type ModuleRow,
  moduleFolder,
} from './mysword-module-fixture';

const ownerId = 'owner';
const otherOwnerId = 'other-owner';
const missingBibleId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const folder = moduleFolder('wordhold-bible-service-test-');

afterAll(folder.remove);

const runServiceTest = <A, E>(
  effect: Effect.Effect<A, E, Database | BibleService>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.all([seedOwner(ownerId), seedOwner(otherOwnerId)]).pipe(
        Effect.andThen(effect),
        Effect.provide(
          BibleService.layer.pipe(
            Layer.provide(BibleStore.live.pipe(Layer.provide(databaseLayer))),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

// Verses from the Luther Bible of 1912, which is in the public domain.
const lutherVerses: ReadonlyArray<ModuleRow> = [
  ...luther1912Psalm23,
  [40, 17, 20, 'Jesus aber antwortete und sprach:'],
  [40, 17, 21, '- - -'],
  [40, 17, 22, 'Da sie aber ihr Wesen hatten in Galiläa,'],
  [
    43,
    3,
    16,
    'Also hat Gott die Welt geliebt, daß er seinen eingebornen Sohn gab.',
  ],
  // Psalm 119 is long enough that it does not fit one text as a whole.
  ...Array.from(
    { length: 60 },
    (_, index): ModuleRow => [
      19,
      119,
      index + 1,
      'Wohl denen, die ohne Wandel leben, die im Gesetze des HERRN wandeln!',
    ],
  ),
];

const luther = (abbreviation = 'LUT1912', verses = lutherVerses) =>
  folder.write(abbreviation, {
    details: [
      ['Title', 'Lutherbibel 1912'],
      ['Abbreviation', abbreviation],
    ],
    verses,
  });

const verseCount = (bibleId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const [row] = yield* sql<{ readonly count: number }>`
      select count(*)::int as count from bible_verses where bible_id = ${bibleId}
    `;
    return row?.count;
  });

describe('BibleService imports', () => {
  it('imports a Bible for its uploader only', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const service = yield* BibleService;
        const bible = yield* service.importModule(ownerId, luther());
        expect(bible).toEqual({
          id: expect.any(String),
          name: 'Lutherbibel 1912',
          abbreviation: 'LUT1912',
          verseCount: 69,
        });
        expect(yield* service.list(ownerId)).toEqual([bible]);
        expect(yield* service.list(otherOwnerId)).toEqual([]);
      }),
    );
  });

  it('stores a whole Bible in batches', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const service = yield* BibleService;
        const genesis = Array.from(
          { length: 2500 },
          (_, index): ModuleRow => [
            1,
            Math.floor(index / 50) + 1,
            (index % 50) + 1,
            'Am Anfang schuf Gott Himmel und Erde.',
          ],
        );
        const bible = yield* service.importModule(
          ownerId,
          luther('LUT-GEN', genesis),
        );
        expect(bible.verseCount).toBe(2500);
        expect(yield* verseCount(bible.id)).toBe(2500);
      }),
    );
  });

  it('refuses a second Bible with the same abbreviation', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const service = yield* BibleService;
        yield* service.importModule(ownerId, luther());
        const error = yield* Effect.flip(
          service.importModule(ownerId, luther()),
        );
        expect(error).toMatchObject({
          _tag: 'BibleConflictError',
          message:
            'Du hast schon eine Bibel mit der Abkürzung „LUT1912“. Entferne sie zuerst, wenn du sie ersetzen willst.',
        });
        yield* service.importModule(otherOwnerId, luther());
        expect(yield* service.list(ownerId)).toHaveLength(1);
      }),
    );
  });
});

describe('BibleService lookups', () => {
  it('looks up a verse, a run of verses and a whole chapter', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const service = yield* BibleService;
        const { id } = yield* service.importModule(ownerId, luther());
        expect(yield* service.lookUp(ownerId, id, 'joh 3,16')).toEqual({
          title: 'Johannes 3,16',
          text: 'Also hat Gott die Welt geliebt, daß er seinen eingebornen Sohn gab.',
        });
        expect(yield* service.lookUp(ownerId, id, 'Ps 23,1-2')).toEqual({
          title: 'Psalm 23,1–2',
          text: 'Der HERR ist mein Hirte;\nmir wird nichts mangeln.\nEr weidet mich auf einer grünen Aue\nund führet mich zum frischen Wasser.',
        });
        const psalm = yield* service.lookUp(ownerId, id, 'Psalm 23');
        expect(psalm.title).toBe('Psalm 23');
        expect(psalm.text.split('\n')).toHaveLength(15);
      }),
    );
  });

  it('explains why a passage cannot be looked up', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const service = yield* BibleService;
        const { id } = yield* service.importModule(ownerId, luther());
        const failure = (bibleId: string, reference: string) =>
          Effect.flip(service.lookUp(ownerId, bibleId, reference)).pipe(
            Effect.map(({ _tag, message }) => ({ _tag, message })),
          );
        expect(yield* failure(id, 'Joh')).toEqual({
          _tag: 'BibleReferenceError',
          message:
            '„Joh“ ist keine Bibelstelle. Schreib sie zum Beispiel als „Joh 3,16“ oder „Ps 23,1-3“.',
        });
        expect(yield* failure(id, 'Ps 24,1')).toEqual({
          _tag: 'PassageNotFoundError',
          message: 'Psalm 24 steht nicht in LUT1912.',
        });
        expect(yield* failure(id, 'Ps 23,5-7')).toEqual({
          _tag: 'PassageNotFoundError',
          message: 'Psalm 23 hat in LUT1912 nur 6 Verse.',
        });
        expect(yield* failure(id, 'Mt 17,21')).toEqual({
          _tag: 'PassageNotFoundError',
          message: 'Matthäus 17,21 steht nicht in LUT1912.',
        });
        expect(yield* failure(id, 'Ps 119')).toEqual({
          _tag: 'PassageTooLongError',
          message: 'Psalm 119 ist zu lang für einen Text. Wähle weniger Verse.',
        });
        expect(yield* failure(missingBibleId, 'Ps 23,1')).toEqual({
          _tag: 'BibleNotFoundError',
          message: 'Diese Bibel gibt es nicht mehr. Lade die Seite neu.',
        });
        const stranger = yield* Effect.flip(
          service.lookUp(otherOwnerId, id, 'Ps 23,1'),
        );
        expect(stranger._tag).toBe('BibleNotFoundError');
      }),
    );
  });
});

describe('BibleService removal', () => {
  it('removes a Bible with its verses for its uploader only', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const service = yield* BibleService;
        const { id } = yield* service.importModule(ownerId, luther());
        const stranger = yield* Effect.flip(service.remove(otherOwnerId, id));
        expect(stranger._tag).toBe('BibleNotFoundError');
        expect(yield* verseCount(id)).toBe(69);
        yield* service.remove(ownerId, id);
        expect(yield* service.list(ownerId)).toEqual([]);
        expect(yield* verseCount(id)).toBe(0);
      }),
    );
  });

  it('removes the Bibles of a deleted account', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const service = yield* BibleService;
        const { id } = yield* service.importModule(ownerId, luther());
        yield* sql`delete from "user" where id = ${ownerId}`;
        expect(yield* service.list(ownerId)).toEqual([]);
        expect(yield* verseCount(id)).toBe(0);
      }),
    );
  });
});
