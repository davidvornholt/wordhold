import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type ModuleRow = readonly [
  book: number,
  chapter: number,
  verse: number,
  scripture: string,
];

export type ModuleFile = {
  // The Details table's columns and values, spelled as a module spells them.
  readonly details?: ReadonlyArray<readonly [column: string, value: string]>;
  readonly verses?: ReadonlyArray<ModuleRow>;
  readonly bibleTable?: boolean;
};

const writeModule = (path: string, file: ModuleFile) => {
  rmSync(path, { force: true });
  const database = new DatabaseSync(path);
  if (file.details !== undefined) {
    const columns = file.details.map(([column]) => `${column} text`);
    database.exec(`create table Details (${columns.join(', ')})`);
    database
      .prepare(
        `insert into Details values (${file.details.map(() => '?').join(', ')})`,
      )
      .run(...file.details.map(([, value]) => value));
  }
  if (file.bibleTable !== false) {
    database.exec(
      'create table Bible (Book int, Chapter int, Verse int, Scripture text)',
    );
    const insert = database.prepare('insert into Bible values (?, ?, ?, ?)');
    database.exec('begin');
    for (const verse of file.verses ?? []) {
      insert.run(...verse);
    }
    database.exec('commit');
  }
  database.close();
};

// A private folder that small modules in the MySword layout are written to
// and read back from as the bytes an upload would carry. A module of the
// same name is replaced.
export const moduleFolder = (prefix: string) => {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  return {
    write: (name: string, file: ModuleFile): Uint8Array => {
      const path = join(folder, `${name}.bbl.mybible`);
      writeModule(path, file);
      return new Uint8Array(readFileSync(path));
    },
    remove: () => rmSync(folder, { recursive: true, force: true }),
  };
};

// The temporary folders the module reader has not removed.
export const readerFolders = () =>
  readdirSync(tmpdir()).filter((name) => name.startsWith('wordhold-bible-'));

const psalms = 19;
const shepherdPsalm = 23;

// Psalm 23 from the Luther Bible of 1912, which is in the public domain,
// marked up the way MySword modules mark up a modern translation.
export const luther1912Psalm23: ReadonlyArray<ModuleRow> = [
  '<i>Ein Psalm Davids.</i><CM>Der HERR ist mein Hirte; / mir wird nichts mangeln.',
  'Er weidet mich auf einer grünen Aue / und führet mich zum frischen Wasser.',
  'Er erquicket meine Seele; / er führet mich auf rechter Straße um seines Namens willen.',
  'Und ob ich schon wanderte im finstern Tal, / fürchte ich kein Unglück; / denn du bist bei mir, / dein Stecken und Stab trösten mich.',
  'Du bereitest vor mir einen Tisch gegen meine Feinde. / Du salbest mein Haupt mit Öl / und schenkest mir voll ein.',
  'Gutes und Barmherzigkeit werden mir folgen mein Leben lang, / und ich werde bleiben im Hause des HERRN immerdar.',
].map((scripture, index) => [psalms, shepherdPsalm, index + 1, scripture]);
