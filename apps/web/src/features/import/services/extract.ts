import { Extraction } from '@wordhold/ai/extraction';
import type { ExtractionError } from '@wordhold/ai/extraction/error';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { englishNames } from '../../../shared/languages';
import { ExtractionFailedError } from '../errors/extraction-failed-error';

const failureMessages: Record<ExtractionError['reason'], string> = {
  provider:
    'Der Lesedienst konnte die Seite nicht auslesen. Versuche es in ein paar Minuten noch einmal.',
  invalidOutput:
    'Die Antwort des Lesedienstes war unbrauchbar. Versuche es noch einmal.',
};

// What the learner reads when a page cannot be read; the provider's own
// message and cause stay attached for the server log.
export const extractionFailed = (error: ExtractionError) =>
  new ExtractionFailedError({
    message: failureMessages[error.reason],
    cause: error,
  });

export const extractPage = (input: {
  readonly imageBase64: string;
  readonly mediaType: string;
  readonly language: LanguageCode;
}) =>
  Effect.gen(function* () {
    const extraction = yield* Extraction;
    return yield* extraction.extract({
      imageBase64: input.imageBase64,
      mediaType: input.mediaType,
      targetLanguage: englishNames[input.language],
    });
  }).pipe(Effect.mapError(extractionFailed));
