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

const justDueAt = new Date();

const item = {
  cardId: '00000000-0000-0000-0000-000000000001',
  revision: 0,
  direction: 'to_target' as const,
  entryId: '00000000-0000-0000-0000-000000000002',
  targetText: 'memory',
  nativeText: 'Erinnerung',
  hasAudio: false,
  example: {
    targetText: 'This memory still makes me smile.',
    nativeText: 'Diese Erinnerung bringt mich noch immer zum Lächeln.',
    source: 'textbook' as const,
    hasAudio: true,
  },
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
const prepareExamples = ({ data }: { readonly data: Array<string> }) =>
  Promise.resolve(data.map((entryId) => ({ entryId, example: item.example })));

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
      prepareExamples={prepareExamples}
      repeated={true}
      submit={() => {
        navigateToFixture('practice-feedback');
        return Promise.resolve(result);
      }}
      targetLabel="Englisch"
      targetLanguage="en"
    />
  </PageLayout>
);

export const PracticeFeedbackFixture = () => (
  <PageLayout backControl={backControl} title="English A2: Üben">
    <FeedbackPanel
      audioPlaying={false}
      busy={false}
      example={item.example}
      onNext={() => navigateToFixture('practice-empty')}
      onResolveWrong={() => navigateToFixture('practice-empty')}
      playSentence={null}
      playWord={null}
      resolution={null}
      repeated={false}
      result={result}
      skipped={false}
      submittedAnswer="wrong"
      targetLanguage="en"
      stopAudio={() => undefined}
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
      dueAt: justDueAt,
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
        continueControl={fixtureControl('Weiter üben', 'practice', 'primary')}
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
    setSubmittedAnswer(data.skipped === true ? '(übersprungen)' : data.answer);
    return pending.promise;
  };
  return (
    <PageLayout backControl={backControl} title="English A2: Üben">
      <CardPractice
        item={{ ...item, hasAudio: true }}
        mode="scheduled"
        onNext={() => undefined}
        prepareExamples={prepareExamples}
        repeated={false}
        submit={submit}
        targetLabel="Englisch"
        targetLanguage="en"
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
