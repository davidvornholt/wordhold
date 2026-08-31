import { useRef, useState } from 'react';
import type { SubmitResult } from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import {
  advanceQueue,
  createSessionQueue,
} from '../src/features/practice/services/session-queue';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import { FeedbackPanel } from '../src/features/practice/ui/feedback-panel';
import { SessionSummary } from '../src/features/practice/ui/session-summary';
import { PageLayout } from '../src/shared/ui/page-layout';
import { ProgressMeter } from '../src/shared/ui/progress-meter';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
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

const backControl = fixtureBackControl('Übersicht', 'dashboard');

export const PracticeFixture = () => (
  <PageLayout backControl={backControl} title="English A2: Üben">
    <div className="flex flex-col gap-1.5">
      <p className="font-medium text-sm">Abschnitt 1</p>
      <ProgressMeter
        accessibleName="Fortschritt"
        description="0 von 1 Karte bearbeitet"
        total={1}
        value={0}
      />
    </div>
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
  </PageLayout>
);

export const PracticeFeedbackFixture = () => (
  <PageLayout backControl={backControl} title="English A2: Üben">
    <FeedbackPanel
      audioUrl={null}
      onNext={() => navigateToFixture('practice-empty')}
      onResolveWrong={() => navigateToFixture('practice-empty')}
      resolution={null}
      repeated={false}
      result={result}
      submittedAnswer="wrong"
    />
  </PageLayout>
);

export const PracticeEmptyFixture = () => (
  <PageLayout backControl={backControl} title="English A2: Üben">
    <SessionSummary
      backControl={fixtureControl(
        'Zurück zur Übersicht',
        'dashboard',
        'quiet-muted',
      )}
      emptyMessage="Für jetzt geschafft"
      queue={createSessionQueue([])}
      remainingReady={0}
    />
  </PageLayout>
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
    <PageLayout backControl={backControl} title="English A2: Üben">
      <SessionSummary
        backControl={backControl}
        emptyMessage="Für jetzt geschafft"
        queue={queue}
        remainingReady={0}
      />
    </PageLayout>
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
    <PageLayout backControl={backControl} title="English A2: Üben">
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
    </PageLayout>
  );
};
