import { Tts } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { persistFileReference } from '../../../shared/storage/consistency';
import { audioRelativePath, Storage } from '../../../shared/storage/server';
import { ImportRepository, type InsertedEntry } from './repository';

export const maximumAudioProviderCallsPerImport = 50;
const maximumConsecutiveFailures = 3;

export const generateAudio = (
  insertedEntries: ReadonlyArray<InsertedEntry>,
  language: LanguageCode,
) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const storage = yield* Storage;
    const tts = yield* Tts;
    let generated = 0;
    let consecutiveFailures = 0;
    for (const entry of insertedEntries.slice(
      0,
      maximumAudioProviderCallsPerImport,
    )) {
      const completed = yield* tts
        .synthesize({ text: entry.targetText, language })
        .pipe(
          Effect.flatMap((result) => {
            const path = audioRelativePath(entry.id, result.voice);
            return persistFileReference({
              write: storage.write(path, result.audio),
              persistReference: repository.upsertAudioReference(
                entry.id,
                result.voice,
                path,
              ),
              remove: storage.remove(path),
            });
          }),
          Effect.match({ onFailure: () => false, onSuccess: () => true }),
        );
      if (completed) {
        generated += 1;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures += 1;
        if (consecutiveFailures >= maximumConsecutiveFailures) {
          break;
        }
      }
    }
    return generated;
  });
