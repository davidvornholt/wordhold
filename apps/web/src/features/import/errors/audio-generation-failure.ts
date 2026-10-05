import { TtsError } from '@wordhold/ai/tts/error';
import { Schema } from 'effect';
import { FileReferenceError } from '../../../shared/storage/file-reference-error';
import { StorageError } from '../../../shared/storage/storage-error';
import { ImportDatabaseError } from './import-database-error';

export const AudioGenerationCause = Schema.Union([
  TtsError,
  StorageError,
  ImportDatabaseError,
  FileReferenceError,
]);
export type AudioGenerationCause = typeof AudioGenerationCause.Type;

export class AudioGenerationFailure extends Schema.TaggedError<AudioGenerationFailure>()(
  'AudioGenerationFailure',
  {
    entryId: Schema.String,
    cause: AudioGenerationCause,
    message: Schema.String,
  },
) {}
