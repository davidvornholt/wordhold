import { useCallback, useEffect, useRef, useState } from 'react';

export const useAudioPlayback = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

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
    setPlaying(false);
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
        setPlaying(false);
      }
    };
    setPlaying(true);
    await current.play().catch(() => {
      if (audioRef.current === current) {
        audioRef.current = null;
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
