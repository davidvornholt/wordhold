import { Extraction, type ExtractionResult } from '@wordhold/ai/extraction';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { extractionRuntime } from '../ai/runtime';
import { englishNames } from '../languages';

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const extensionForMime = (mime: string): string | undefined =>
  extensionByMime[mime];

export const mimeForPath = (path: string): string =>
  mimeByExtension[path.slice(path.lastIndexOf('.') + 1)] ?? 'image/jpeg';

export const runExtraction = (input: {
  readonly imageBase64: string;
  readonly mediaType: string;
  readonly language: LanguageCode;
}): Promise<ExtractionResult> =>
  extractionRuntime.runPromise(
    Effect.gen(function* () {
      const extraction = yield* Extraction;
      return yield* extraction.extract({
        imageBase64: input.imageBase64,
        mediaType: input.mediaType,
        targetLanguage: englishNames[input.language],
      });
    }),
  );
