import { turnStoredPhoto } from '@wordhold/ai/extraction/page-image';
import { NotesExtraction } from '@wordhold/ai/notes';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { extractionFailed } from './extract';
import type { NotesReading } from './repository';

// Reads a subject's photographed notes. A photo taken sideways is stored
// upright, so the review shows the notes the way they were read. A retry
// reads the upright photo, which needs no further turn.
export const extractNotes = (input: {
  readonly image: Uint8Array;
  readonly imagePath: string;
}) =>
  Effect.gen(function* () {
    const extraction = yield* NotesExtraction;
    const reading = yield* extraction
      .extract(input.image)
      .pipe(Effect.mapError(extractionFailed));
    if (reading.turned !== 0) {
      const upright = yield* turnStoredPhoto(input.image, reading.turned).pipe(
        Effect.mapError(extractionFailed),
      );
      yield* (yield* Storage).write(input.imagePath, upright);
    }
    return {
      notes: reading.notes,
      modelId: reading.modelId,
    } satisfies NotesReading;
  });
