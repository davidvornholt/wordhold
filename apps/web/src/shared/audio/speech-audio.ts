import type { Tts } from '@wordhold/ai/tts';
import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import type { LanguageCode } from '@wordhold/db/schema/courses';

export const speechAudioProfile = (
  text: string,
  language: LanguageCode,
): string => ttsAudioProfile(text, language);

export const synthesizeSpeechAudio = (
  tts: Tts,
  text: string,
  language: LanguageCode,
) => tts.synthesize({ text, language });
