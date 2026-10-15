import { useRef, useState } from 'react';
import type {
  CourseEntryPlace,
  FeedbackResult,
  ResolvedSubmitResult,
  SubmitResult,
} from '../schemas/practice-models';
import type {
  SubmitPayloadData,
  WrongAnswerResolution,
} from '../schemas/submission-schema';
import type { OtherWordingAttempt } from './other-wording-notice';
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
  // The learner was waiting for the server then, not thinking: after a failed
  // answer, or after one in other words that left the card open.
  const waitedMsRef = useRef(0);
  const { reconnecting, retry } = useServerRetry();
  const send = async (data: SubmitPayloadData) => {
    const sentAt = performance.now();
    try {
      return await retry(() => submit({ data }));
    } finally {
      waitedMsRef.current += performance.now() - sentAt;
    }
  };
  const elapsedMs = () =>
    Math.floor(performance.now() - startedAt - waitedMsRef.current);
  return { reconnecting, send, elapsedMs };
};

// The last answer in other words than the book's. Each one counts as a new
// try, so the notice shows afresh.
const useOtherWording = () => {
  const [attempt, setAttempt] = useState<OtherWordingAttempt | null>(null);
  const present = (answer: string, courseEntry: CourseEntryPlace | null) =>
    setAttempt((last) => ({
      answer,
      courseEntry,
      attempt: (last?.attempt ?? 0) + 1,
    }));
  return { attempt, present };
};

// One exchange with the server at a time. A caller takes the lock with
// `acquire` before it shows anything, since `busy` refuses a second exchange
// only once React has rendered. A failed exchange is undone and leaves a
// message for the learner, `offline` being the one for a missing connection.
const useExchange = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lock] = useState(createSubmissionLock);
  const run = async (
    task: () => Promise<void>,
    offline: string,
    undo: () => void = () => undefined,
  ) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      undo();
      setError(failureMessage(cause, offline));
    } finally {
      lock.release();
      setBusy(false);
    }
  };
  return { busy, error, setError, acquire: lock.acquire, run };
};

// A resolution has to store the answer before the card can move on. It never
// reopens the card for another try.
const isStoredResolution = (
  result: SubmitResult,
): result is ResolvedSubmitResult =>
  !('otherWording' in result) && (!result.graded || result.stored);

// All state around one card's answer round trip: the deferred first
// submission, the optional skip, and the resolution of a rejected answer. An
// answer in other words than the book's leaves the card open, so the learner
// may try again until the card is judged.
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
  const otherWording = useOtherWording();
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [resolution, setResolution] = useState<StoredResolution | null>(null);
  const exchange = useExchange();
  const { busy } = exchange;
  const server = useCardServer(submit);

  const submitAndPresent = (data: SubmitPayloadData, undo: () => void) =>
    exchange.run(
      async () => {
        const submitted = await server.send(data);
        if ('otherWording' in submitted) {
          // The answer moves into the notice and the field clears for the
          // next try. Only an answer, never a skip, is found in other words.
          otherWording.present(data.answer ?? '', submitted.courseEntry);
          setSubmittedData(null);
          draft.change('');
          return;
        }
        setResult(submitted);
        if (submitted.graded) {
          await playFeedbackAudio();
        }
      },
      submissionError,
      undo,
    );

  const submitAnswer = async () => {
    if (busy || result !== null || !exchange.acquire()) {
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
    if (busy || result !== null || !exchange.acquire()) {
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
      !exchange.acquire()
    ) {
      return;
    }
    setResolution(wrongAnswerResolution);
    await exchange.run(async () => {
      const submitted = await server.send({
        ...submittedData,
        wrongAnswerResolution,
        assessmentId: result.assessmentId,
      });
      if (isStoredResolution(submitted)) {
        setResult(submitted);
        onNext(submitted);
      } else {
        exchange.setError(resolutionError);
      }
    }, resolutionError);
    setResolution(null);
  };

  return {
    answer: draft.answer,
    setAnswer: draft.change,
    appendDictation: draft.appendDictation,
    submittedAnswer: submittedData?.answer ?? null,
    submittedDictated: submittedData?.dictated ?? false,
    skipped,
    otherWording: otherWording.attempt,
    result,
    busy,
    resolution,
    error: exchange.error,
    reconnecting: server.reconnecting,
    submitAnswer,
    skipCard,
    resolveWrongAnswer,
  };
};
