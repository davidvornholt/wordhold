import { Context, Effect, Layer } from 'effect';
import { maximumMemorizedTextLength } from '../../../shared/vocabulary/entry-fields';
import type {
  BibleDatabaseError,
  BibleFileError,
  BibleModuleError,
} from '../errors/bible-errors';
import {
  BibleConflictError,
  BibleNotFoundError,
  BibleReferenceError,
  PassageNotFoundError,
  PassageTooLongError,
} from '../errors/bible-errors';
import type { BibleSummary } from '../schemas/bible-models';
import {
  type BibleReference,
  formatBibleReference,
  parseBibleReference,
} from '../schemas/bible-reference';
import { BibleStore, type FoundChapter } from './bible-store';
import { readMySwordModule } from './mysword-module';

export type BiblePassage = {
  readonly title: string;
  readonly text: string;
};

// A passage is looked up within one chapter. Its verses are joined line by
// line, the way they are recited.
const passageIn = (
  reference: BibleReference,
  { abbreviation, verses }: FoundChapter,
): Effect.Effect<BiblePassage, PassageNotFoundError | PassageTooLongError> => {
  const title = formatBibleReference(reference);
  const place = formatBibleReference({ ...reference, verses: null });
  const lastVerse = verses.at(-1)?.verse;
  if (lastVerse === undefined) {
    return Effect.fail(
      new PassageNotFoundError({
        message: `${place} steht nicht in ${abbreviation}.`,
      }),
    );
  }
  const { first, last } = reference.verses ?? { first: 1, last: lastVerse };
  if (last > lastVerse) {
    return Effect.fail(
      new PassageNotFoundError({
        message: `${place} hat in ${abbreviation} nur ${lastVerse} Verse.`,
      }),
    );
  }
  const passage = verses.filter(({ verse }) => verse >= first && verse <= last);
  if (passage.length === 0) {
    return Effect.fail(
      new PassageNotFoundError({
        message: `${title} steht nicht in ${abbreviation}.`,
      }),
    );
  }
  const text = passage.map((verse) => verse.text).join('\n');
  if (text.length > maximumMemorizedTextLength) {
    return Effect.fail(
      new PassageTooLongError({
        message: `${title} ist zu lang für einen Text. Wähle weniger Verse.`,
      }),
    );
  }
  return Effect.succeed({ title, text });
};

const bibleMissing = new BibleNotFoundError({
  message: 'Diese Bibel gibt es nicht mehr. Lade die Seite neu.',
});

export class BibleService extends Context.Service<
  BibleService,
  {
    readonly importModule: (
      ownerId: string,
      bytes: Uint8Array,
    ) => Effect.Effect<
      BibleSummary,
      | BibleConflictError
      | BibleModuleError
      | BibleFileError
      | BibleDatabaseError
    >;
    readonly list: (
      ownerId: string,
    ) => Effect.Effect<ReadonlyArray<BibleSummary>, BibleDatabaseError>;
    readonly lookUp: (
      ownerId: string,
      bibleId: string,
      typed: string,
    ) => Effect.Effect<
      BiblePassage,
      | BibleDatabaseError
      | BibleReferenceError
      | BibleNotFoundError
      | PassageNotFoundError
      | PassageTooLongError
    >;
    readonly remove: (
      ownerId: string,
      bibleId: string,
    ) => Effect.Effect<void, BibleDatabaseError | BibleNotFoundError>;
  }
>()('wordhold/BibleService') {
  static readonly layer = Layer.effect(
    BibleService,
    Effect.gen(function* () {
      const store = yield* BibleStore;

      const importModule = (ownerId: string, bytes: Uint8Array) =>
        Effect.gen(function* () {
          const module = yield* readMySwordModule(bytes);
          const result = yield* store.insert(ownerId, module);
          if (result.kind === 'conflict') {
            return yield* new BibleConflictError({
              message: `Du hast schon eine Bibel mit der Abkürzung „${module.abbreviation}“. Entferne sie zuerst, wenn du sie ersetzen willst.`,
            });
          }
          return result.bible;
        });

      const list = (ownerId: string) => store.list(ownerId);

      const lookUp = (ownerId: string, bibleId: string, typed: string) =>
        Effect.gen(function* () {
          const parsed = parseBibleReference(typed);
          if (parsed.kind === 'invalid') {
            return yield* new BibleReferenceError({ message: parsed.message });
          }
          const { reference } = parsed;
          const chapter = yield* store.chapter(
            ownerId,
            bibleId,
            reference.book,
            reference.chapter,
          );
          if (chapter.kind === 'bible-missing') {
            return yield* bibleMissing;
          }
          return yield* passageIn(reference, chapter);
        });

      const remove = (ownerId: string, bibleId: string) =>
        store
          .remove(ownerId, bibleId)
          .pipe(
            Effect.flatMap((removed) =>
              removed ? Effect.void : Effect.fail(bibleMissing),
            ),
          );

      return BibleService.of({ importModule, list, lookUp, remove });
    }),
  );
}
