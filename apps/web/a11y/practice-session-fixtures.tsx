import { useState } from 'react';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import type { SubmitResult } from '../src/features/practice/services/practice-service';
import {
  advanceQueue,
  createSessionQueue,
} from '../src/features/practice/services/session-queue';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import {
  PracticeEmpty,
  PracticeLayout,
} from '../src/features/practice/ui/practice-layout';
import { SessionProgress } from '../src/features/practice/ui/session-progress';
import { navigateToFixture } from './fixture-state';

const card = (index: number, target: string, native: string) => ({
  cardId: `0000000-0000-0000-0000-00000000000${index}`,
  revision: 0,
  direction: 'to_target' as const,
  entryId: `0000000-0000-0000-0000-00000000010${index}`,
  entryType: 'word' as const,
  targetText: target,
  nativeText: native,
  hasAudio: false,
  prompt: native,
});

const goodRating = 3;
const againRating = 1;

const items = [
  card(1, 'memory', 'Erinnerung'),
  card(2, 'holiday', 'Ferien'),
] as const;

// Grades against the expected answer the way the server would, and hands back
// the revision the card would have after being written.
const grade = ({ data }: { readonly data: SubmitPayloadData }) => {
  const expected =
    items.find((item) => item.cardId === data.cardId)?.targetText ?? '';
  if (data.answer === 'ungraded') {
    return Promise.resolve<SubmitResult>({
      graded: false,
      expectedAnswers: [expected],
      message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
    });
  }
  const correct = data.answer === expected;
  return Promise.resolve<SubmitResult>({
    graded: true,
    correct,
    revision: data.revision + 1,
    rating: correct ? goodRating : againRating,
    expectedAnswers: [expected],
    explanation: null,
    acceptedAsAlternative: false,
  });
};

// The whole session loop against the real queue, so a missed card genuinely
// comes back and the progress bar genuinely stays where it was.
export const PracticeSessionFixture = () => {
  const [queue, setQueue] = useState(() => createSessionQueue(items));
  const pending = queue.pending.at(0);
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
      title="English A2: Üben"
    >
      <SessionProgress settled={queue.settled} total={queue.total} />
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
          mode="scheduled"
          onNext={(result) =>
            setQueue((current) => advanceQueue(current, pending, result))
          }
          repeated={pending.repeated}
          submit={grade}
          targetLabel="Englisch"
        />
      )}
      <output aria-label="Submitted revision">{pending?.revision ?? -1}</output>
    </PracticeLayout>
  );
};
