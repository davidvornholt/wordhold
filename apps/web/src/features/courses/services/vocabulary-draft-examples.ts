import type { SentenceGen } from '@wordhold/ai/sentence';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type Context, Effect } from 'effect';
import { englishNames } from '../../../shared/languages';
import { decodeGeneratedExample } from '../../../shared/vocabulary/entry-fields';
import { CourseExampleGenerationError } from '../errors/courses-errors';

type SentenceGenerator = Context.Tag.Service<typeof SentenceGen>;

const generationFailed = (message: string) =>
  new CourseExampleGenerationError({ message });

// Sentence generation for a word that is still being typed: nothing is
// stored, the result goes back into the form for the learner to review.
export const generateDraftExample = (
  generator: SentenceGenerator,
  language: LanguageCode,
  word: { readonly targetText: string; readonly nativeText: string },
) =>
  Effect.gen(function* () {
    const batch = yield* generator
      .generate({
        targetText: word.targetText,
        nativeText: word.nativeText,
        targetLanguage: englishNames[language],
        count: 1,
      })
      .pipe(
        Effect.mapError(() =>
          generationFailed('Der Beispielsatz konnte nicht erzeugt werden.'),
        ),
      );
    const [generated] = batch.sentences;
    if (generated === undefined) {
      return yield* generationFailed(
        'Der Sprachdienst hat keinen Beispielsatz geliefert.',
      );
    }
    return yield* decodeGeneratedExample(generated).pipe(
      Effect.mapError(() =>
        generationFailed('Der erzeugte Beispielsatz ist ungültig.'),
      ),
    );
  });

// The missing side of a word pair, in the form a textbook list prints, for
// the learner to review in the form before saving.
export const suggestDraftTranslation = (
  generator: SentenceGenerator,
  language: LanguageCode,
  unitName: string,
  word: { readonly text: string; readonly given: 'target' | 'native' },
) =>
  generator
    .translateWord({
      text: word.text,
      given: word.given,
      targetLanguage: englishNames[language],
      context: unitName,
    })
    .pipe(
      Effect.map((translated) => ({ translation: translated.translation })),
      Effect.mapError(() =>
        generationFailed('Die Übersetzung konnte nicht vorgeschlagen werden.'),
      ),
    );

export const translateDraftExample = (
  generator: SentenceGenerator,
  language: LanguageCode,
  targetText: string,
) =>
  generator
    .translate({ targetText, targetLanguage: englishNames[language] })
    .pipe(
      Effect.map((translated) => ({ native: translated.native })),
      Effect.mapError(() =>
        generationFailed('Die Übersetzung konnte nicht erzeugt werden.'),
      ),
    );
