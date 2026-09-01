import type { LanguageCode } from '@wordhold/db/schema/courses';
import { useCallback, useEffect } from 'react';
import { useAudioPlayback } from '../../../shared/audio/use-pronunciation-audio';
import { Button } from '../../../shared/ui/button';
import { ExampleSentence } from '../../../shared/ui/example-sentence';
import type { LearnItem } from '../schemas/learning-models';

type LearnExampleAudioProps = {
  readonly item: LearnItem;
  readonly targetLanguage: LanguageCode;
};

const LearningAudioControls = ({
  playSentence,
  playWord,
  playing,
  stopAudio,
  wordIsPrimary,
}: {
  readonly playSentence: (() => Promise<void>) | null;
  readonly playWord: (() => Promise<void>) | null;
  readonly playing: boolean;
  readonly stopAudio: () => void;
  readonly wordIsPrimary: boolean;
}) => {
  if (playSentence === null && playWord === null) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-3">
      {playSentence === null ? null : (
        <Button onClick={playSentence} variant="quiet">
          Satz anhören
        </Button>
      )}
      {playWord === null ? null : (
        <Button
          onClick={playWord}
          variant={wordIsPrimary ? 'quiet' : 'quiet-muted'}
        >
          Wort anhören
        </Button>
      )}
      {playing ? (
        <Button onClick={stopAudio} variant="quiet-muted">
          Audio stoppen
        </Button>
      ) : null}
    </div>
  );
};

export const LearnExampleAudio = ({
  item,
  targetLanguage,
}: LearnExampleAudioProps) => {
  const wordAudioUrl = item.hasAudio
    ? `/api/entries/${item.entryId}/audio`
    : null;
  const sentenceAudioUrl = item.example?.hasAudio
    ? `/api/entries/${item.entryId}/example-audio`
    : null;
  const automaticAudioUrl = sentenceAudioUrl ?? wordAudioUrl;
  const { playAudio, playing, stopAudio } = useAudioPlayback();
  const playSentence = useCallback(
    () => playAudio(sentenceAudioUrl),
    [playAudio, sentenceAudioUrl],
  );
  const playWord = useCallback(
    () => playAudio(wordAudioUrl),
    [playAudio, wordAudioUrl],
  );

  useEffect(() => {
    if (automaticAudioUrl === null) {
      return;
    }
    const playTask = globalThis.setTimeout(() => {
      playAudio(automaticAudioUrl).catch(() => undefined);
    });
    return () => globalThis.clearTimeout(playTask);
  }, [automaticAudioUrl, playAudio]);

  const controls = (
    <LearningAudioControls
      playSentence={sentenceAudioUrl === null ? null : playSentence}
      playWord={wordAudioUrl === null ? null : playWord}
      playing={playing}
      stopAudio={stopAudio}
      wordIsPrimary={item.example === null}
    />
  );

  if (item.example === null) {
    return wordAudioUrl === null ? null : controls;
  }

  return (
    <ExampleSentence
      controls={controls}
      example={item.example}
      targetLanguage={targetLanguage}
    />
  );
};
