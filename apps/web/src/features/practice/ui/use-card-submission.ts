import { useRef, useState } from 'react';
import type {
  ResolvedSubmitResult,
  SubmitResult,
} from '../schemas/practice-models';
import type {
  SubmitPayloadData,
  WrongAnswerResolution,
} from '../schemas/submission-schema';
import { failureMessage } from './server-retry';
import { useServerRetry } from './use-server-retry';

type DeferredSubmitData = Extract<
  SubmitPayloadData,
  { readonly wrongAnswerResolution: 'defer' }
>;
type StoredResolution = Exclude<WrongAnswerResolution, 'defer'>;

const submissionError =
  'Deine Antwort konnte nicht geprüft werden. Prüfe deine Verbindung und versuche es noch einmal.';
const resolutionError =
  'Die Bewertung konnte nicht gespeichert werden. Versuche es noch einmal.';

const createSubmissionLock = () => {
  let active = false;
  return {
    acquire: () => {
      if (active) {
        return false;
      }
      active = true;
      return true;
    },
    release: () => {
      active = false;
    },
  };
};

type CardSubmissionInput = {
  readonly cardId: string;
  readonly revision: number;
  readonly mode: DeferredSubmitData['mode'];
  readonly playFeedbackAudio: () => Promise<void>;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
  readonly onNext: (result: ResolvedSubmitResult) => void;
};

// The answer being written. It counts as dictated once speech recognition
// wrote part of it; typing keeps it so, since the spoken words are still
// there, and clearing the answer starts over.
const useAnswerDraft = () => {
  const [answer, setAnswer] = useState('');
  const [dictated, setDictated] = useState(false);
  const change = (value: string) => {
    setAnswer(value);
    if (value.trim() === '') {
      setDictated(false);
    }
  };
  // Spoken words go after what is already there.
  const appendDictation = (transcript: string) => {
    setAnswer((current) =>
      current.trim() === '' ? transcript : `${current.trimEnd()} ${transcript}`,
    );
    setDictated(true);
  };
  return { answer, dictated, change, appendDictation };
};

// Sends this card's submissions and measures the time spent answering it.
// Repeating a submission is safe: the server stores an answer only for the
// card revision it was sent with, so a repeat after a lost response is
// refused as already answered instead of counted twice, and the judge's
// verdicts are cached.
const useCardServer = (submit: CardSubmissionInput['submit']) => {
  const [startedAt] = useState(() => performance.now());
  // The learner was waiting for the server then, not thinking.
  const failedMsRef = useRef(0);
  const { reconnecting, retry } = useServerRetry();
  const send = async (data: SubmitPayloadData) => {
    const sentAt = performance.now();
    try {
      return await retry(() => submit({ data }));
    } catch (cause) {
      failedMsRef.current += performance.now() - sentAt;
      throw cause;
    }
  };
  const elapsedMs = () =>
    Math.floor(performance.now() - startedAt - failedMsRef.current);
  return { reconnecting, send, elapsedMs };
};

// All state around one card's answer round trip: the deferred first
// submission, the optional skip, and the resolution of a rejected answer.
export const useCardSubmission = ({
  cardId,
  revision,
  mode,
  playFeedbackAudio,
  submit,
  onNext,
}: CardSubmissionInput) => {
  const draft = useAnswerDraft();
  const [submittedData, setSubmittedData] = useState<DeferredSubmitData | null>(
    null,
  );
  const [skipped, setSkipped] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<StoredResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionLock] = useState(createSubmissionLock);
  const server = useCardServer(submit);

  const submitAndPresent = async (
    data: SubmitPayloadData,
    rollback: () => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const submitted = await server.send(data);
      setResult(submitted);
      if (submitted.graded) {
        await playFeedbackAudio();
      }
    } catch (cause) {
      rollback();
      setError(failureMessage(cause, submissionError));
    } finally {
      submissionLock.release();
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (busy || result !== null || !submissionLock.acquire()) {
      return;
    }
    const data: DeferredSubmitData = {
      cardId,
      revision,
      answer: draft.answer,
      dictated: draft.dictated,
      elapsedMs: server.elapsedMs(),
      wrongAnswerResolution: 'defer',
      mode,
    };
    setSubmittedData(data);
    await submitAndPresent(data, () => setSubmittedData(null));
  };

  const skipCard = async () => {
    if (busy || result !== null || !submissionLock.acquire()) {
      return;
    }
    setSkipped(true);
    await submitAndPresent(
      {
        cardId,
        revision,
        elapsedMs: server.elapsedMs(),
        skipped: true,
        mode,
      },
      () => setSkipped(false),
    );
  };

  const resolveWrongAnswer = async (
    wrongAnswerResolution: StoredResolution,
  ) => {
    if (
      busy ||
      submittedData === null ||
      result === null ||
      !result.graded ||
      result.stored ||
      !submissionLock.acquire()
    ) {
      return;
    }
    setBusy(true);
    setResolution(wrongAnswerResolution);
    setError(null);
    try {
      const submitted = await server.send({
        ...submittedData,
        wrongAnswerResolution,
        assessmentId: result.assessmentId,
      });
      // A resolution has to store the answer before the card can move on.
      if (submitted.graded && !submitted.stored) {
        setError(resolutionError);
      } else {
        setResult(submitted);
        onNext(submitted);
      }
    } catch (cause) {
      setError(failureMessage(cause, resolutionError));
    } finally {
      submissionLock.release();
      setBusy(false);
      setResolution(null);
    }
  };

  return {
    answer: draft.answer,
    setAnswer: draft.change,
    appendDictation: draft.appendDictation,
    submittedAnswer: submittedData?.answer ?? null,
    submittedDictated: submittedData?.dictated ?? false,
    skipped,
    result,
    busy,
    resolution,
    error,
    reconnecting: server.reconnecting,
    submitAnswer,
    skipCard,
    resolveWrongAnswer,
  };
};
