import type { TtsResult } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { persistFileReference } from '../storage/consistency';
import { audioRelativePath } from '../storage/server';

export type AudioEntry = {
  readonly id: string;
  readonly targetText: string;
};

export const maximumAudioProviderCallsPerImport = 50;
const maximumConsecutiveFailures = 3;

type AudioGenerationDependencies = {
  readonly synthesize: (
    text: string,
    language: LanguageCode,
  ) => Promise<TtsResult>;
  readonly writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  readonly removeFile: (path: string) => Promise<void>;
  readonly insertReference: (
    entryId: string,
    voice: string,
    path: string,
  ) => Promise<void>;
};

export const generateAudio = async (
  insertedEntries: ReadonlyArray<AudioEntry>,
  language: LanguageCode,
  dependencies: AudioGenerationDependencies,
) => {
  let generated = 0;
  let consecutiveFailures = 0;
  const budgetedEntries = insertedEntries.slice(
    0,
    maximumAudioProviderCallsPerImport,
  );
  for (const entry of budgetedEntries) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: the fixed call budget is deliberately sequential to avoid provider bursts
      const result = await dependencies.synthesize(entry.targetText, language);
      const path = audioRelativePath(entry.id, result.voice);
      await persistFileReference({
        write: () => dependencies.writeFile(path, result.audio),
        persistReference: () =>
          dependencies.insertReference(entry.id, result.voice, path),
        remove: () => dependencies.removeFile(path),
      });
      generated += 1;
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= maximumConsecutiveFailures) {
        break;
      }
    }
  }
  return generated;
};
