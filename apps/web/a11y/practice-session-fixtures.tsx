import type { ReviewMode } from '@wordhold/db/schema/practice';
import { useState } from 'react';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import type {
  ResolvedSubmitResult,
  SubmitResult,
} from '../src/features/practice/services/practice-service';
import {
  advanceQueue,
  createSessionQueue,
} from '../src/features/practice/services/session-queue';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import {
  PracticeEmpty,
  PracticeLayout,
} from '../src/features/practice/ui/practice-layout';
import { ProgressMeter } from '../src/shared/ui/progress-meter';
import { navigateToFixture } from './fixture-state';

const card = (index: number, target: string, native: string) => ({
  cardId: `0000000-0000-0000-0000-00000000000${index}`,
  revision: 0,
  direction: 'to_target' as const,
  entryId: `0000000-0000-0000-0000-00000000010${index}`,
  targetText: target,
  nativeText: native,
  hasAudio: false,
  prompt: native,
});

const goodRating = 3;
const hardRating = 2;
const againRating = 1;

const resolvedRating = (correct: boolean, corrected: boolean) => {
  if (correct) {
    return goodRating;
  }
  return corrected ? hardRating : againRating;
};

const items = [
  card(1, 'memory', 'Erinnerung'),
  card(2, 'holiday', 'Ferien'),
] as const;

// Grades against the expected answer the way the server would, and hands back
// the revision the card would have after being written.
const grade = (
  sessionItems: ReadonlyArray<ReturnType<typeof card>>,
  { data }: { readonly data: SubmitPayloadData },
) => {
  const expected =
    sessionItems.find((item) => item.cardId === data.cardId)?.targetText ?? '';
  if (data.answer === 'ungraded') {
    return Promise.resolve<SubmitResult>({
      graded: false,
      expectedAnswers: [expected],
      message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
    });
  }
  const correct = data.answer === expected;
  if (!correct && data.wrongAnswerResolution === 'defer') {
    return Promise.resolve<SubmitResult>({
      graded: true,
      correct: false,
      stored: false,
      expectedAnswers: [expected],
      explanation: null,
      acceptedAsAlternative: false,
    });
  }
  const corrected = !correct && data.wrongAnswerResolution === 'hard';
  return Promise.resolve<SubmitResult>({
    graded: true,
    correct: correct || corrected,
    stored: true,
    revision: data.revision + 1,
    rating: resolvedRating(correct, corrected),
    expectedAnswers: [expected],
    explanation: null,
    acceptedAsAlternative: false,
  });
};

// The whole session loop against the real queue, so a missed card genuinely
// comes back and the progress bar genuinely stays where it was.
type PracticeSessionFixtureProps = {
  readonly sessionItems?: ReadonlyArray<ReturnType<typeof card>>;
  readonly mode?: ReviewMode;
  readonly title?: string;
};

export const PracticeSessionFixture = ({
  sessionItems = items,
  mode = 'scheduled',
  title = 'English A2: Üben',
}: PracticeSessionFixtureProps) => {
  const [queue, setQueue] = useState(() => createSessionQueue(sessionItems));
  const [visibleResult, setVisibleResult] =
    useState<ResolvedSubmitResult | null>(null);
  const pending = queue.pending.at(0);
  const visibleQueue =
    pending === undefined || visibleResult === null
      ? queue
      : advanceQueue(queue, pending, visibleResult);
  const cardLabel = queue.total === 1 ? 'Karte' : 'Karten';
  return (
    <PracticeLayout
      backControl={
        <button
          className="w-fit text-muted-foreground text-sm underline"
          onClick={() => navigateToFixture('dashboard')}
          type="button"
        >
          ← Übersicht
        </button>
      }
      title={title}
    >
      <ProgressMeter
        accessibleName="Fortschritt"
        description={`${visibleQueue.settled} von ${queue.total} ${cardLabel} bearbeitet`}
        total={queue.total}
        value={visibleQueue.settled}
      />
      {pending === undefined ? (
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
          correct={queue.correct}
          emptyMessage="Gerade ist nichts fällig."
          total={queue.total}
          ungraded={queue.ungraded}
          wrong={queue.wrong}
        />
      ) : (
        <CardPractice
          item={pending}
          key={`${pending.cardId}-${pending.revision}`}
          mode={mode}
          onNext={(result) => {
            setQueue((current) => advanceQueue(current, pending, result));
            setVisibleResult(null);
          }}
          onResult={setVisibleResult}
          repeated={pending.repeated}
          submit={(input) => grade(sessionItems, input)}
          targetLabel="Englisch"
        />
      )}
      <output aria-label="Submitted revision">{pending?.revision ?? -1}</output>
    </PracticeLayout>
  );
};

// Unit drills may contain review cards whose existing date is still in the
// future. The practice item does not expose that server-owned date to the UI.
export const FutureDrillSessionFixture = () => (
  <PracticeSessionFixture
    mode="drill"
    sessionItems={[items[0]]}
    title="Unit 3 – Holidays üben"
  />
);
