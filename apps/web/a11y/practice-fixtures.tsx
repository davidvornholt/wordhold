import { useRef, useState } from 'react';
import type { SubmitResult } from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import {
  advanceQueue,
  createSessionQueue,
} from '../src/features/practice/services/session-queue';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import { FeedbackPanel } from '../src/features/practice/ui/feedback-panel';
import { PracticeLayout } from '../src/features/practice/ui/practice-layout';
import { SessionProgress } from '../src/features/practice/ui/session-progress';
import { SessionSummary } from '../src/features/practice/ui/session-summary';
import { navigateToFixture } from './fixture-state';

const item = {
  cardId: '00000000-0000-0000-0000-000000000001',
  revision: 0,
  direction: 'to_target' as const,
  entryId: '00000000-0000-0000-0000-000000000002',
  targetText: 'memory',
  nativeText: 'Erinnerung',
  hasAudio: false,
  prompt: 'Erinnerung',
};

const result: SubmitResult = {
  graded: true,
  correct: false,
  stored: false,
  expectedAnswers: ['memory'],
  explanation: 'Das bedeutet etwas anderes.',
  acceptedAsAlternative: false,
  assessmentId: '00000000-0000-0000-0000-000000000003',
};

const backControl = (
  <button
    className="w-fit text-muted-foreground text-sm underline"
    onClick={() => navigateToFixture('dashboard')}
    type="button"
  >
    ← Übersicht
  </button>
);

export const PracticeFixture = () => (
  <PracticeLayout backControl={backControl} title="English A2: Üben">
    <SessionProgress
      phase="main"
      processed={0}
      repeatCount={0}
      section={1}
      total={1}
    />
    <CardPractice
      item={item}
      mode="scheduled"
      onNext={() => undefined}
      repeated={true}
      submit={() => {
        navigateToFixture('practice-feedback');
        return Promise.resolve(result);
      }}
      targetLabel="Englisch"
    />
  </PracticeLayout>
);

export const PracticeFeedbackFixture = () => (
  <PracticeLayout backControl={backControl} title="English A2: Üben">
    <FeedbackPanel
      audioUrl={null}
      onNext={() => navigateToFixture('practice-empty')}
      onResolveWrong={() => navigateToFixture('practice-empty')}
      resolution={null}
      repeated={false}
      result={result}
      submittedAnswer="wrong"
    />
  </PracticeLayout>
);

export const PracticeEmptyFixture = () => (
  <PracticeLayout backControl={backControl} title="English A2: Üben">
    <SessionSummary
      backControl={
        <button
          className="w-fit text-sm underline"
          onClick={() => navigateToFixture('dashboard')}
          type="button"
        >
          Zurück zur Übersicht
        </button>
      }
      emptyMessage="Für jetzt geschafft"
      queue={createSessionQueue([])}
      remainingReady={0}
    />
  </PracticeLayout>
);

type PracticeOneCardSummaryFixtureProps = {
  readonly ungraded: boolean;
};

export const PracticeOneCardSummaryFixture = ({
  ungraded,
}: PracticeOneCardSummaryFixtureProps) => {
  const correctResult: SubmitResult = {
    graded: true,
    correct: true,
    stored: true,
    revision: 1,
    rating: 3,
    expectedAnswers: ['memory'],
    explanation: null,
    acceptedAsAlternative: false,
    schedule: {
      advanced: true,
      state: 'review',
      dueAt: new Date('2026-08-30T12:00:00Z'),
    },
  };
  const unavailable: SubmitResult = {
    graded: false,
    expectedAnswers: ['memory'],
    message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
  };
  const queue = advanceQueue(
    createSessionQueue([item]),
    item,
    ungraded ? unavailable : correctResult,
  );
  return (
    <PracticeLayout backControl={backControl} title="English A2: Üben">
      <SessionSummary
        backControl={backControl}
        emptyMessage="Für jetzt geschafft"
        queue={queue}
        remainingReady={0}
      />
    </PracticeLayout>
  );
};

type DeferredResult = {
  readonly promise: Promise<SubmitResult>;
  readonly resolve: (value: SubmitResult) => void;
  readonly reject: (cause: unknown) => void;
};

const makeDeferred = (): DeferredResult => {
  let resolve: DeferredResult['resolve'] = () => undefined;
  let reject: DeferredResult['reject'] = () => undefined;
  const promise = new Promise<SubmitResult>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};

export const DeferredPracticeFixture = () => {
  const deferred = useRef<DeferredResult | null>(null);
  const [calls, setCalls] = useState(0);
  const [submittedAnswer, setSubmittedAnswer] = useState('none');
  const submit = ({ data }: { readonly data: SubmitPayloadData }) => {
    const pending = makeDeferred();
    deferred.current = pending;
    setCalls((count) => count + 1);
    setSubmittedAnswer(data.answer);
    return pending.promise;
  };
  return (
    <PracticeLayout backControl={backControl} title="English A2: Üben">
      <CardPractice
        item={item}
        mode="scheduled"
        onNext={() => undefined}
        repeated={false}
        submit={submit}
        targetLabel="Englisch"
      />
      <output aria-label="Submit calls">{calls}</output>
      <output aria-label="Submitted answer">{submittedAnswer}</output>
      <fieldset>
        <legend>Test controls</legend>
        <button onClick={() => deferred.current?.resolve(result)} type="button">
          Resolve submission
        </button>
        <button
          onClick={() => deferred.current?.reject(new Error('Test rejection'))}
          type="button"
        >
          Reject submission
        </button>
      </fieldset>
    </PracticeLayout>
  );
};
