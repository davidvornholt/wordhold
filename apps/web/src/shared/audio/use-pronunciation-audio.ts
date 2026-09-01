import { useCallback, useEffect, useRef, useState } from 'react';

export const useAudioPlayback = () => {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [],
  );

  const stopAudio = useCallback(() => {
    const { current } = audio;
    audio.current = null;
    current?.pause();
    setPlaying(false);
  }, []);

  const playAudio = useCallback(async (audioUrl: string | null) => {
    if (audioUrl === null) {
      return;
    }
    audio.current?.pause();
    const current = new Audio(audioUrl);
    audio.current = current;
    current.onended = () => {
      if (audio.current === current) {
        audio.current = null;
        setPlaying(false);
      }
    };
    setPlaying(true);
    await current.play().catch(() => {
      if (audio.current === current) {
        audio.current = null;
        setPlaying(false);
      }
    });
  }, []);

  return { playAudio, playing, stopAudio } as const;
};

export const usePronunciationAudio = (audioUrl: string | null) => {
  const { playAudio } = useAudioPlayback();
  return useCallback(() => playAudio(audioUrl), [audioUrl, playAudio]);
};
