import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';
import { Effect } from 'effect';
import { BibleFileError, BibleModuleError } from '../errors/bible-errors';
import {
  type BibleVerse,
  type ModuleVerse,
  moduleVerses,
} from './module-verses';

// A Bible as Wordhold keeps it: its name, the abbreviation a reader picks it
// by, and its verses as the translation numbers them.
export type BibleModule = {
  readonly name: string;
  readonly abbreviation: string;
  readonly verses: ReadonlyArray<BibleVerse>;
};

const sqliteHeader = new TextEncoder().encode('SQLite format 3\0');

// The English Bible has 31,102 verses. A module with the Apocrypha has a few
// thousand more, so a file with far more rows is not a Bible.
const maximumModuleRows = 50_000;

const maximumNameLength = 200;
const maximumAbbreviationLength = 40;

const notAModule = (cause?: unknown) =>
  new BibleModuleError({
    cause,
    message:
      'Die Datei ist keine MySword-Bibel. Lade eine Datei hoch, deren Name auf „.bbl.mybible“ endet.',
  });

const hasSqliteHeader = (bytes: Uint8Array) =>
  bytes.length > sqliteHeader.length &&
  sqliteHeader.every((byte, index) => bytes[index] === byte);

const shortened = (text: string, length: number) =>
  text.replace(/\s+/gu, ' ').trim().slice(0, length).trim();

// MySword keeps the title and abbreviation in a one-row Details table. Older
// modules spell the column names differently, so they are matched without
// case.
const readDetails = (database: DatabaseSync) => {
  const table = database
    .prepare(
      "select 1 from sqlite_master where type = 'table' and lower(name) = 'details'",
    )
    .get();
  if (table === undefined) {
    return { name: '', abbreviation: '' };
  }
  const row = database.prepare('select * from Details limit 1').get() ?? {};
  const field = (name: string) => {
    const value = Object.entries(row).find(
      ([column]) => column.toLowerCase() === name,
    )?.[1];
    return typeof value === 'string' ? value : '';
  };
  return {
    name: shortened(field('title') || field('description'), maximumNameLength),
    abbreviation: shortened(field('abbreviation'), maximumAbbreviationLength),
  };
};

// A row whose numbers or text are missing or of another type is not a
// verse, and is skipped.
const asModuleVerse = ({
  book,
  chapter,
  verse,
  scripture,
}: Record<string, SQLOutputValue>): Array<ModuleVerse> =>
  typeof book === 'number' &&
  typeof chapter === 'number' &&
  typeof verse === 'number' &&
  typeof scripture === 'string'
    ? [{ book, chapter, verse, scripture }]
    : [];

const readRows = (database: DatabaseSync): Array<ModuleVerse> => {
  const table = database
    .prepare(
      "select 1 from sqlite_master where type = 'table' and name = 'Bible'",
    )
    .get();
  if (table === undefined) {
    throw notAModule();
  }
  const count = database.prepare('select count(*) as rows from Bible').get();
  if (Number(count?.rows) > maximumModuleRows) {
    throw notAModule();
  }
  return database
    .prepare(
      'select Book as book, Chapter as chapter, Verse as verse, Scripture as scripture from Bible',
    )
    .all()
    .flatMap(asModuleVerse);
};

const readModuleFile = (path: string): BibleModule => {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const details = readDetails(database);
    const verses = moduleVerses(readRows(database));
    const name = details.name || details.abbreviation || 'Bibel';
    return {
      name,
      abbreviation:
        details.abbreviation || shortened(name, maximumAbbreviationLength),
      verses,
    };
  } finally {
    database.close();
  }
};

// SQLite in Node and Bun opens databases only from files, so the upload is
// written to a private temporary folder that is removed again afterwards.
export const readMySwordModule = (
  bytes: Uint8Array,
): Effect.Effect<BibleModule, BibleModuleError | BibleFileError> =>
  hasSqliteHeader(bytes)
    ? Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), 'wordhold-bible-')),
          catch: (cause) =>
            new BibleFileError({
              cause,
              message: 'Die Bibel konnte nicht zwischengespeichert werden.',
            }),
        }),
        (folder) =>
          Effect.gen(function* () {
            const path = join(folder, 'module.mybible');
            yield* Effect.tryPromise({
              try: () => writeFile(path, bytes, { mode: 0o600 }),
              catch: (cause) =>
                new BibleFileError({
                  cause,
                  message: 'Die Bibel konnte nicht zwischengespeichert werden.',
                }),
            });
            const read = yield* Effect.try({
              try: () => readModuleFile(path),
              catch: (cause) =>
                cause instanceof BibleModuleError ? cause : notAModule(cause),
            });
            if (read.verses.length === 0) {
              return yield* new BibleModuleError({
                message: 'In der Datei stehen keine Bibelverse.',
              });
            }
            return read;
          }),
        (folder) =>
          Effect.tryPromise(() =>
            rm(folder, { recursive: true, force: true }),
          ).pipe(Effect.ignore),
      )
    : Effect.fail(notAModule());
