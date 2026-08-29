import { useRef, useState } from 'react';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import type { SubmitResult } from '../src/features/practice/services/practice-service';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import { FeedbackPanel } from '../src/features/practice/ui/feedback-panel';
import {
  PracticeEmpty,
  PracticeLayout,
} from '../src/features/practice/ui/practice-layout';
import { SessionProgress } from '../src/features/practice/ui/session-progress';
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
  revision: 1,
  rating: 1,
  expectedAnswers: ['memory'],
  explanation: 'Das bedeutet etwas anderes.',
  acceptedAsAlternative: false,
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
    <SessionProgress settled={0} total={1} />
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
      result={result}
    />
  </PracticeLayout>
);

export const PracticeEmptyFixture = () => (
  <PracticeLayout backControl={backControl} title="English A2: Üben">
    <PracticeEmpty
      backControl={
        <button
          className="w-fit text-sm underline"
          onClick={() => navigateToFixture('dashboard')}
          type="button"
        >
          Zurück zur Übersicht
        </button>
      }
      correct={0}
      emptyMessage="Gerade ist nichts fällig."
      total={0}
      ungraded={0}
      wrong={0}
    />
  </PracticeLayout>
);

type PracticeOneCardSummaryFixtureProps = {
  readonly ungraded: boolean;
};

export const PracticeOneCardSummaryFixture = ({
  ungraded,
}: PracticeOneCardSummaryFixtureProps) => (
  <PracticeLayout backControl={backControl} title="English A2: Üben">
    <PracticeEmpty
      backControl={backControl}
      correct={ungraded ? 0 : 1}
      emptyMessage="Gerade ist nichts fällig."
      total={1}
      ungraded={ungraded ? 1 : 0}
      wrong={0}
    />
  </PracticeLayout>
);

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
