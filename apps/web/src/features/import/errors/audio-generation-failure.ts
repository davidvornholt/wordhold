import type { Tts } from '@wordhold/ai/tts';
import { Data, type Effect } from 'effect';
import type { FileReferenceError } from '../../../shared/storage/file-reference-error';
import type { StorageError } from '../../../shared/storage/storage-error';
import type { ImportDatabaseError } from './import-database-error';

type TtsFailure = Effect.Effect.Error<ReturnType<Tts['synthesize']>>;

export type AudioGenerationCause =
  | TtsFailure
  | StorageError
  | ImportDatabaseError
  | FileReferenceError;

export class AudioGenerationFailure extends Data.TaggedError(
  'AudioGenerationFailure',
)<{
  readonly entryId: string;
  readonly cause: AudioGenerationCause;
  readonly message: string;
}> {}
