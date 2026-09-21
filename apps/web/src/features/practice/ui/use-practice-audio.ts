import { useCallback, useEffect, useRef } from 'react';
import { useAudioPlayback } from '../../../shared/audio/use-pronunciation-audio';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';

// Whether this card is still on screen, read at the moment it matters. The
// controller is created by the effect and read through a ref, so StrictMode's
// simulated unmount and remount in development aborts one controller and
// hands the card a fresh one, instead of leaving it aborted for good.
const useLifetime = () => {
  const lifetimeRef = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    lifetimeRef.current = controller;
    return () => controller.abort();
  }, []);
  return useCallback(() => !lifetimeRef.current.signal.aborted, []);
};

type PracticeAudioInput = {
  readonly entryId: string;
  readonly hasWordAudio: boolean;
  readonly example: PreparedExampleSentence | null;
  readonly loadExample: () => Promise<PreparedExampleSentence | null>;
};

// The card's three sounds: the word, the example sentence, and the automatic
// playback after a graded answer, which prefers the sentence once prepared.
export const usePracticeAudio = ({
  entryId,
  hasWordAudio,
  example,
  loadExample,
}: PracticeAudioInput) => {
  const isOnScreen = useLifetime();
  const wordAudioUrl = hasWordAudio ? `/api/entries/${entryId}/audio` : null;
  const sentenceAudioUrl = example?.hasAudio
    ? `/api/entries/${entryId}/example-audio`
    : null;
  const { playAudio, playing, stopAudio } = useAudioPlayback();
  const playSentence = useCallback(
    () => playAudio(sentenceAudioUrl),
    [playAudio, sentenceAudioUrl],
  );
  const playWord = useCallback(
    () => playAudio(wordAudioUrl),
    [playAudio, wordAudioUrl],
  );
  const playFeedbackAudio = useCallback(async () => {
    const prepared = await loadExample();
    if (!isOnScreen()) {
      return;
    }
    const preparedSentenceUrl = prepared?.hasAudio
      ? `/api/entries/${entryId}/example-audio`
      : null;
    await playAudio(preparedSentenceUrl ?? wordAudioUrl);
  }, [entryId, isOnScreen, loadExample, playAudio, wordAudioUrl]);
  return {
    playing,
    stopAudio,
    playFeedbackAudio,
    playSentence: sentenceAudioUrl === null ? null : playSentence,
    playWord: wordAudioUrl === null ? null : playWord,
  };
};
