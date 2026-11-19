import { useCallback, useEffect, useRef, useState } from 'react';

// One sound a card can play, and whether it is playing now.
export type SoundControl = {
  readonly play: () => Promise<void>;
  readonly stop: () => void;
  readonly playing: boolean;
};

export const useAudioPlayback = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // The URL of the sound playing now, so each control can show its own.
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const stopAudio = useCallback(() => {
    const { current } = audioRef;
    audioRef.current = null;
    current?.pause();
    setPlayingUrl(null);
  }, []);

  const playAudio = useCallback(async (audioUrl: string | null) => {
    if (audioUrl === null) {
      return;
    }
    audioRef.current?.pause();
    const current = new Audio(audioUrl);
    audioRef.current = current;
    current.onended = () => {
      if (audioRef.current === current) {
        audioRef.current = null;
        setPlayingUrl(null);
      }
    };
    setPlayingUrl(audioUrl);
    await current.play().catch(() => {
      if (audioRef.current === current) {
        audioRef.current = null;
        setPlayingUrl(null);
      }
    });
  }, []);

  // The control for one URL, or null when there is nothing to play.
  const sound = useCallback(
    (audioUrl: string | null): SoundControl | null =>
      audioUrl === null
        ? null
        : {
            play: () => playAudio(audioUrl),
            stop: stopAudio,
            playing: playingUrl === audioUrl,
          },
    [playAudio, playingUrl, stopAudio],
  );

  return { playAudio, playingUrl, sound, stopAudio } as const;
};

export const usePronunciationAudio = (audioUrl: string | null) => {
  const { playAudio } = useAudioPlayback();
  return useCallback(() => playAudio(audioUrl), [audioUrl, playAudio]);
};
