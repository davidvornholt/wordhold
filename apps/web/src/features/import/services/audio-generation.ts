import { Tts } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect, Either } from 'effect';
import { persistFileReference } from '../../../shared/storage/consistency';
import { audioRelativePath, Storage } from '../../../shared/storage/server';
import { AudioGenerationFailure } from '../errors/audio-generation-failure';
import {
  AudioGenerationStore,
  type AudioTarget,
} from './audio-generation-store';
import type { InsertedEntry } from './repository';

export const maximumAudioProviderCallsPerImport = 50;
const maximumConsecutiveFailures = 3;

export type AudioGenerationReport = {
  readonly generated: number;
  readonly alreadyAvailable: number;
  readonly pending: number;
  readonly failures: ReadonlyArray<AudioGenerationFailure>;
};

export const serializableAudioReport = (report: AudioGenerationReport) => ({
  generated: report.generated,
  alreadyAvailable: report.alreadyAvailable,
  pending: report.pending,
  failures: report.failures.map((failure) => ({
    entryId: failure.entryId,
    causeTag: failure.cause._tag,
    message: failure.message,
  })),
});

const generateEntryAudio = (entry: AudioTarget) =>
  Effect.gen(function* () {
    const store = yield* AudioGenerationStore;
    const storage = yield* Storage;
    const tts = yield* Tts;
    return yield* store.withCriticalSection(
      entry.id,
      Effect.gen(function* () {
        if (yield* store.hasReference(entry.id)) {
          return 'already-available' as const;
        }
        const result = yield* tts.synthesize({
          text: entry.targetText,
          language: entry.language,
        });
        const path = audioRelativePath(entry.id, result.voice);
        yield* persistFileReference({
          write: storage.write(path, result.audio),
          persistReference: store.upsertReference(entry.id, result.voice, path),
          remove: storage.remove(path),
        });
        return 'generated' as const;
      }),
    );
  });

const generateTargets = (targets: ReadonlyArray<AudioTarget>) =>
  Effect.gen(function* () {
    const failures: Array<AudioGenerationFailure> = [];
    let generated = 0;
    let alreadyAvailable = 0;
    let consecutiveFailures = 0;
    for (const entry of targets.slice(0, maximumAudioProviderCallsPerImport)) {
      const outcome = yield* generateEntryAudio(entry).pipe(Effect.either);
      if (Either.isRight(outcome)) {
        if (outcome.right === 'generated') {
          generated += 1;
        } else {
          alreadyAvailable += 1;
        }
        consecutiveFailures = 0;
      } else {
        failures.push(
          new AudioGenerationFailure({
            entryId: entry.id,
            cause: outcome.left,
            message: 'Die Audiodatei konnte nicht erstellt werden.',
          }),
        );
        consecutiveFailures += 1;
        if (consecutiveFailures >= maximumConsecutiveFailures) {
          break;
        }
      }
    }
    return {
      generated,
      alreadyAvailable,
      pending: targets.length - generated - alreadyAvailable,
      failures,
    } satisfies AudioGenerationReport;
  });

export const generateAudio = (
  insertedEntries: ReadonlyArray<InsertedEntry>,
  language: LanguageCode,
) => generateTargets(insertedEntries.map((entry) => ({ ...entry, language })));

export const retryPageAudio = (pageId: string) =>
  Effect.gen(function* () {
    const store = yield* AudioGenerationStore;
    const missing = yield* store.listMissingForPage(pageId);
    const report = yield* generateTargets(missing);
    const remaining = yield* store.listMissingForPage(pageId);
    return {
      generated: report.generated,
      alreadyAvailable: report.alreadyAvailable,
      pending: remaining.length,
      failures: report.failures,
    } satisfies AudioGenerationReport;
  });
