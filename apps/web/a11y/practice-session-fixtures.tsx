import type { ReviewMode } from '@wordhold/db/schema/practice';
import { useRef, useState } from 'react';
import type {
  PracticeSession,
  SubmitResult,
} from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import { SessionRunner } from '../src/features/practice/ui/session-runner';
import { ratings } from '../src/shared/grading/rating';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl, fixtureControl } from './fixture-controls';

const millisecondsPerDay = 86_400_000;
const millisecondsPerSecond = 1000;
type FixtureCard = PracticeSession['items'][number];

const card = (index: number, target: string, native: string): FixtureCard => ({
  cardId: `0000000-0000-0000-0000-00000000000${index}`,
  revision: 0,
  direction: 'to_target' as const,
  entryId: `0000000-0000-0000-0000-00000000010${index}`,
  targetText: target,
  nativeText: native,
  hasAudio: false,
  example: null,
  prompt: native,
});

const items = [
  card(1, 'memory', 'Erinnerung'),
  card(2, 'holiday', 'Ferien'),
] as const;

const audioItems = [
  {
    ...items[0],
    hasAudio: true,
    example: {
      targetText: 'This memory still makes me smile.',
      nativeText: 'Diese Erinnerung bringt mich immer noch zum Lächeln.',
      source: 'textbook' as const,
      hasAudio: true,
    },
  },
] as const;

type PreparedExamples = ReadonlyArray<{
  readonly entryId: string;
  readonly example: FixtureCard['example'];
}>;

type DeferredExamples = {
  readonly promise: Promise<PreparedExamples>;
  readonly resolve: (value: PreparedExamples) => void;
};

const makeDeferredExamples = (): DeferredExamples => {
  let resolve: DeferredExamples['resolve'] = () => undefined;
  const promise = new Promise<PreparedExamples>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

const resolvedRating = (correct: boolean, corrected: boolean) => {
  if (correct) {
    return ratings.good;
  }
  return corrected ? ratings.hard : ratings.again;
};

const grade = (
  sessionItems: ReadonlyArray<FixtureCard>,
  { data }: { readonly data: SubmitPayloadData },
): Promise<SubmitResult> => {
  const expected =
    sessionItems.find((item) => item.cardId === data.cardId)?.targetText ?? '';
  if ('skipped' in data) {
    return Promise.resolve({
      graded: true,
      correct: false,
      stored: true,
      revision: data.revision + 1,
      rating: ratings.again,
      expectedAnswers: [expected],
      explanation: null,
      acceptedAsAlternative: false,
      schedule: {
        advanced: true,
        state: 'relearning',
        dueAt: new Date(Date.now() - millisecondsPerSecond),
      },
    });
  }
  if (data.answer === 'ungraded') {
    return Promise.resolve({
      graded: false,
      expectedAnswers: [expected],
      message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
    });
  }
  const correct = data.answer === expected;
  if (!correct && data.wrongAnswerResolution === 'defer') {
    return Promise.resolve({
      graded: true,
      correct: false,
      stored: false,
      expectedAnswers: [expected],
      explanation: null,
      acceptedAsAlternative: false,
      assessmentId: '00000000-0000-0000-0000-000000000003',
    });
  }
  const corrected = !correct && data.wrongAnswerResolution === 'hard';
  const resolvedCorrect = correct || corrected;
  const scheduleAdvances = data.mode === 'scheduled' || !resolvedCorrect;
  return Promise.resolve({
    graded: true,
    correct: resolvedCorrect,
    stored: true,
    revision: data.revision + 1,
    rating: resolvedRating(correct, corrected),
    expectedAnswers: [expected],
    explanation: null,
    acceptedAsAlternative: false,
    schedule: {
      advanced: scheduleAdvances,
      state: resolvedCorrect ? 'review' : 'relearning',
      dueAt: resolvedCorrect
        ? new Date(Date.now() + millisecondsPerDay)
        : new Date(Date.now() - millisecondsPerSecond),
    },
  });
};

type PracticeSessionFixtureProps = {
  readonly sessionItems?: ReadonlyArray<FixtureCard>;
  readonly mode?: ReviewMode;
  readonly title?: string;
};

export const PracticeSessionFixture = ({
  sessionItems,
  mode = 'scheduled',
  title = 'English A2: Üben',
}: PracticeSessionFixtureProps) => {
  const fixtureSearch = new URLSearchParams(globalThis.location.search);
  const lateExample = fixtureSearch.get('late-example') === 'true';
  const deferredExample = fixtureSearch.get('deferred-example') === 'true';
  const deferred = useRef<DeferredExamples | null>(null);
  const [showSession, setShowSession] = useState(true);
  let activeItems: ReadonlyArray<FixtureCard> = sessionItems ?? items;
  if (sessionItems === undefined && (lateExample || deferredExample)) {
    activeItems = [{ ...audioItems[0], example: null }];
  } else if (
    sessionItems === undefined &&
    fixtureSearch.get('audio') === 'true'
  ) {
    activeItems = audioItems;
  }
  const session: PracticeSession = {
    items: activeItems,
    available: {
      due: activeItems.length,
      firstReviews: 0,
      ready: activeItems.length,
      nextDueAt: null,
    },
  };
  const backControl = fixtureControl(
    'Zurück zur Übersicht',
    'dashboard',
    'quiet-muted',
  );
  const preparedExamples = (entryIds: ReadonlyArray<string>) =>
    entryIds.map((entryId) => ({
      entryId,
      example:
        (lateExample || deferredExample ? audioItems : activeItems).find(
          (item) => item.entryId === entryId,
        )?.example ?? null,
    }));
  const prepareExamples = ({ data }: { readonly data: Array<string> }) => {
    const prepared = preparedExamples(data);
    if (!deferredExample) {
      return Promise.resolve(prepared);
    }
    const pending = makeDeferredExamples();
    deferred.current = pending;
    return pending.promise;
  };
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard')}
      title={title}
    >
      {showSession ? (
        <SessionRunner
          backControl={backControl}
          emptyMessage="Für jetzt geschafft"
          mode={mode}
          prepareExamples={prepareExamples}
          session={session}
          submit={(input) => grade(activeItems, input)}
          targetLabel="Englisch"
          targetLanguage="en"
        />
      ) : null}
      {deferredExample ? (
        <div>
          <button onClick={() => setShowSession(false)} type="button">
            Sitzung ausblenden
          </button>
          <button
            onClick={() =>
              deferred.current?.resolve(
                preparedExamples(activeItems.map((item) => item.entryId)),
              )
            }
            type="button"
          >
            Beispielsatz freigeben
          </button>
        </div>
      ) : null}
    </PageLayout>
  );
};

export const FutureStudySessionFixture = () => (
  <PracticeSessionFixture
    mode="drill"
    sessionItems={[items[0]]}
    title="Unit 3: Holidays üben"
  />
);
