import { useCallback, useEffect, useRef } from 'react';

export const useAudioPlayback = () => {
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [],
  );

  return useCallback(async (audioUrl: string | null) => {
    if (audioUrl === null) {
      return;
    }
    audio.current?.pause();
    const current = new Audio(audioUrl);
    audio.current = current;
    await current.play().catch(() => undefined);
  }, []);
};

export const usePronunciationAudio = (audioUrl: string | null) => {
  const playAudio = useAudioPlayback();
  return useCallback(() => playAudio(audioUrl), [audioUrl, playAudio]);
};
