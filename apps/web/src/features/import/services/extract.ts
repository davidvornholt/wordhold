import { Extraction } from '@wordhold/ai/extraction';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { englishNames } from '../../../shared/languages';

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
  });
