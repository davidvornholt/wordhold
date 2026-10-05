import { afterAll, describe, expect, it } from 'bun:test';
import { Effect, Result } from 'effect';
import { readMySwordModule } from './mysword-module';
import { moduleFolder, readerFolders } from './mysword-module-fixture';

const folder = moduleFolder('wordhold-module-test-');

afterAll(folder.remove);

// Verses from the Luther Bible of 1912, which is in the public domain.
const luther = [
  [1, 1, 1, 'Am Anfang schuf Gott Himmel und Erde.'],
  [
    43,
    3,
    16,
    'Also hat Gott die Welt geliebt,<RF>Oder: so sehr<Rf> daß er seinen eingebornen Sohn gab.',
  ],
] as const;

const read = (bytes: Uint8Array) =>
  Effect.runPromise(Effect.result(readMySwordModule(bytes)));

const refusal = (bytes: Uint8Array) =>
  Effect.runPromise(
    Effect.flip(readMySwordModule(bytes)).pipe(
      Effect.map(({ _tag, message }) => ({ _tag, message })),
    ),
  );

const notAModule = {
  _tag: 'BibleModuleError' as const,
  message:
    'Die Datei ist keine MySword-Bibel. Lade eine Datei hoch, deren Name auf „.bbl.mybible“ endet.',
};

describe('readMySwordModule', () => {
  it('reads the name, the abbreviation and the verses', async () => {
    const before = readerFolders();
    const result = await read(
      folder.write('luther', {
        details: [
          ['Title', 'Lutherbibel 1912'],
          ['Abbreviation', 'LUT1912'],
        ],
        verses: luther,
      }),
    );
    expect(result).toEqual(
      Result.succeed({
        name: 'Lutherbibel 1912',
        abbreviation: 'LUT1912',
        verses: [
          {
            book: 1,
            chapter: 1,
            verse: 1,
            text: 'Am Anfang schuf Gott Himmel und Erde.',
          },
          {
            book: 43,
            chapter: 3,
            verse: 16,
            text: 'Also hat Gott die Welt geliebt, daß er seinen eingebornen Sohn gab.',
          },
        ],
      }),
    );
    expect(readerFolders()).toEqual(before);
  });

  it('names a module without details after what it has', async () => {
    const titled = await read(
      folder.write('titled', {
        details: [['title', 'Lutherbibel 1912']],
        verses: luther,
      }),
    );
    const untitled = await read(folder.write('untitled', { verses: luther }));
    expect(
      Result.map(titled, ({ name, abbreviation }) => ({ name, abbreviation })),
    ).toEqual(
      Result.succeed({
        name: 'Lutherbibel 1912',
        abbreviation: 'Lutherbibel 1912',
      }),
    );
    expect(
      Result.map(untitled, ({ name, abbreviation }) => ({
        name,
        abbreviation,
      })),
    ).toEqual(Result.succeed({ name: 'Bibel', abbreviation: 'Bibel' }));
  });

  it('refuses a file that is not a Bible module', async () => {
    expect(await refusal(new TextEncoder().encode('Am Anfang'))).toEqual(
      notAModule,
    );
    expect(
      await refusal(
        folder.write('commentary', {
          details: [['Title', 'Kommentar']],
          bibleTable: false,
        }),
      ),
    ).toEqual(notAModule);
    expect(await refusal(folder.write('empty', { verses: [] }))).toEqual({
      _tag: 'BibleModuleError',
      message: 'In der Datei stehen keine Bibelverse.',
    });
  });

  it('refuses generated columns in either uploaded table', async () => {
    expect(
      await Promise.all(
        (['Bible', 'Details'] as const).map((generatedTable) =>
          refusal(
            folder.write(`generated-${generatedTable}`, {
              generatedTable,
              verses: luther,
            }),
          ),
        ),
      ),
    ).toEqual([notAModule, notAModule]);
  });
});
