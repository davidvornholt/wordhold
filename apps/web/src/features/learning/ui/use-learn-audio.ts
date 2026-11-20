import { useEffect } from 'react';
import { useAudioPlayback } from '../../../shared/audio/use-pronunciation-audio';
import type { LearnItem } from '../schemas/learning-models';

export type LearnAudioInput = {
  readonly item: LearnItem;
  // The example sentence is still being prepared. It may arrive, or the word
  // stays without one.
  readonly pending: boolean;
};

// The word's sound and its example sentence's. What plays on its own waits
// until the example is settled, so the sentence is heard once rather than
// the word first and the sentence a moment later; until then the word can
// still be played by hand.
export const useLearnAudio = ({ item, pending }: LearnAudioInput) => {
  const wordAudioUrl = item.hasAudio
    ? `/api/entries/${item.entryId}/audio`
    : null;
  const sentenceAudioUrl = item.example?.hasAudio
    ? `/api/entries/${item.entryId}/example-audio`
    : null;
  const automaticAudioUrl = pending ? null : (sentenceAudioUrl ?? wordAudioUrl);
  const { playAudio, sound } = useAudioPlayback();

  useEffect(() => {
    if (automaticAudioUrl === null) {
      return;
    }
    const playTask = globalThis.setTimeout(() => {
      playAudio(automaticAudioUrl).catch(() => undefined);
    });
    return () => globalThis.clearTimeout(playTask);
  }, [automaticAudioUrl, playAudio]);

  return { word: sound(wordAudioUrl), sentence: sound(sentenceAudioUrl) };
};
