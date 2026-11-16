import type { Tts } from '@wordhold/ai/tts';
import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import type { LanguageCode } from '@wordhold/db/schema/courses';

export const speechAudioProfile = (
  text: string,
  language: LanguageCode,
): string => ttsAudioProfile(text, language);

// One lock per entry for generating its pronunciation, so a page retry and an
// unchanged save never both call the speech provider for the same word.
export const entryAudioLockKey = (entryId: string): string =>
  `wordhold:entry-audio:${entryId}`;

export const synthesizeSpeechAudio = (
  tts: Tts['Service'],
  text: string,
  language: LanguageCode,
) => tts.synthesize({ text, language });
