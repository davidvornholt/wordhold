import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  dictationContentType,
  maximumDictationSeconds,
} from '../schemas/dictation';
import {
  dictationSupported,
  type Recording,
  startRecording,
} from './dictation-recorder';

export type DictationStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'transcribing';

type Transcription =
  | { readonly transcript: string }
  | { readonly error: string };

const secondMs = 1000;
const uploadFailed =
  'Die Aufnahme konnte nicht übertragen werden. Prüfe deine Verbindung und versuche es noch einmal.';
const nothingHeard =
  'In der Aufnahme wurde nichts erkannt. Sprich deutlich und versuche es noch einmal.';

const subscribeToNothing = () => () => undefined;

const microphoneMessage = (error: unknown): string => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') {
    return 'Wordhold darf das Mikrofon nicht benutzen. Erlaube es in den Einstellungen deines Browsers.';
  }
  if (name === 'NotFoundError') {
    return 'Es wurde kein Mikrofon gefunden.';
  }
  return 'Das Mikrofon konnte nicht gestartet werden. Versuche es noch einmal.';
};

const stringField = (body: unknown, key: string): string | undefined => {
  if (typeof body !== 'object' || body === null) {
    return;
  }
  const value: unknown = Reflect.get(body, key);
  return typeof value === 'string' ? value : undefined;
};

// A refused recording answers with the reason, which is shown as it is.
const transcribe = async (
  audio: Uint8Array<ArrayBuffer>,
): Promise<Transcription> => {
  try {
    const response = await fetch('/api/dictations', {
      method: 'POST',
      headers: { 'Content-Type': dictationContentType },
      body: audio,
    });
    const body: unknown = await response.json().catch(() => null);
    const transcript = stringField(body, 'transcript');
    if (response.ok && transcript !== undefined) {
      return { transcript: transcript.trim() };
    }
    return { error: stringField(body, 'error') ?? uploadFailed };
  } catch {
    return { error: uploadFailed };
  }
};

// Records an answer from the microphone and hands over the recognized text.
// The recording stops by itself at the length the server accepts.
export const useDictation = (onTranscript: (transcript: string) => void) => {
  const supported = useSyncExternalStore(
    subscribeToNothing,
    dictationSupported,
    () => false,
  );
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const mountedRef = useRef(false);
  // Counts starts, so a start that was given up on can tell once the browser
  // answers.
  const attemptRef = useRef(0);

  // Leaving the card turns the microphone off.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingRef.current?.cancel();
      recordingRef.current = null;
    };
  }, []);

  const stop = async () => {
    const { current } = recordingRef;
    if (current === null) {
      return;
    }
    recordingRef.current = null;
    setStatus('transcribing');
    const result = await transcribe(current.stop());
    setStatus('idle');
    if ('error' in result) {
      setMessage(result.error);
    } else if (result.transcript === '') {
      setMessage(nothingHeard);
    } else {
      onTranscript(result.transcript);
    }
  };

  const start = async () => {
    if (status !== 'idle') {
      return;
    }
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    setMessage(null);
    setStatus('starting');
    try {
      const started = await startRecording();
      if (!mountedRef.current || attempt !== attemptRef.current) {
        started.cancel();
        return;
      }
      recordingRef.current = started;
      setSeconds(0);
      setStatus('recording');
    } catch (error) {
      if (attempt === attemptRef.current) {
        setMessage(microphoneMessage(error));
        setStatus('idle');
      }
    }
  };

  // The browser may ask for the microphone for as long as the learner leaves
  // its prompt open. Answering or skipping meanwhile gives up on the
  // recording, and the microphone is turned off again if it is allowed later.
  const abandonStart = () => {
    if (status === 'starting') {
      attemptRef.current += 1;
      setStatus('idle');
    }
  };

  const stopAtLimit = useEffectEvent(() => {
    stop().catch(() => undefined);
  });
  useEffect(() => {
    if (status !== 'recording') {
      return;
    }
    const startedAt = performance.now();
    const timer = globalThis.setInterval(() => {
      const elapsed = Math.floor((performance.now() - startedAt) / secondMs);
      setSeconds(elapsed);
      if (elapsed >= maximumDictationSeconds) {
        stopAtLimit();
      }
    }, secondMs);
    return () => globalThis.clearInterval(timer);
  }, [status]);

  return { supported, status, seconds, message, start, stop, abandonStart };
};

export type Dictation = ReturnType<typeof useDictation>;
