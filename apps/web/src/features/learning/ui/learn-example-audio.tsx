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

  if (item.example === null) {
    return wordAudioUrl === null ? null : (
      <div className="flex flex-wrap gap-3">
        <Button className="w-fit" onClick={playWord} variant="quiet">
          Wort anhören
        </Button>
        {playing ? (
          <Button onClick={stopAudio} variant="quiet-muted">
            Audio stoppen
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ExampleSentence
      controls={
        sentenceAudioUrl === null && wordAudioUrl === null ? null : (
          <div className="flex flex-wrap gap-3">
            {sentenceAudioUrl === null ? null : (
              <Button onClick={playSentence} variant="quiet">
                Satz anhören
              </Button>
            )}
            {wordAudioUrl === null ? null : (
              <Button onClick={playWord} variant="quiet-muted">
                Wort anhören
              </Button>
            )}
            {playing ? (
              <Button onClick={stopAudio} variant="quiet-muted">
                Audio stoppen
              </Button>
            ) : null}
          </div>
        )
      }
      example={item.example}
      targetLanguage={targetLanguage}
    />
  );
};
