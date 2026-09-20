import { useCallback, useEffect, useState } from 'react';
import { useAudioPlayback } from '../../../shared/audio/use-pronunciation-audio';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';

const useLifetime = () => {
  const [lifetime] = useState(() => new AbortController());
  useEffect(() => () => lifetime.abort(), [lifetime]);
  return lifetime.signal;
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
  const lifetime = useLifetime();
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
    if (lifetime.aborted) {
      return;
    }
    const preparedSentenceUrl = prepared?.hasAudio
      ? `/api/entries/${entryId}/example-audio`
      : null;
    await playAudio(preparedSentenceUrl ?? wordAudioUrl);
  }, [entryId, lifetime, loadExample, playAudio, wordAudioUrl]);
  return {
    playing,
    stopAudio,
    playFeedbackAudio,
    playSentence: sentenceAudioUrl === null ? null : playSentence,
    playWord: wordAudioUrl === null ? null : playWord,
  };
};
