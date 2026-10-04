import { sttSampleRate } from '@wordhold/ai/stt/audio';

// A recording travels as mono 16-bit little-endian PCM, the form speech
// recognition reads, so the server passes it on unchanged.
export const dictationSampleRate = sttSampleRate;
export const dictationContentType = `audio/pcm; rate=${dictationSampleRate}; channels=1`;

// A recording stops itself after five minutes, longer than reciting a long
// psalm takes.
export const maximumDictationSeconds = 300;
