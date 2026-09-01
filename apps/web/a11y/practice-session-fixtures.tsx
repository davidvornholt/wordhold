import type { ReviewMode } from '@wordhold/db/schema/practice';
import { useRef, useState } from 'react';
import type { PracticeSession } from '../src/features/practice/schemas/practice-models';
import { SessionRunner } from '../src/features/practice/ui/session-runner';
import { PageLayout } from '../src/shared/ui/page-layout';
import { DeferredExampleControls } from './deferred-example-controls';
import {
  type DeferredExamples,
  makeDeferredExamples,
} from './deferred-examples';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { gradeFixtureAnswer } from './practice-session-grade';

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
          submit={(input) => gradeFixtureAnswer(activeItems, input)}
          targetLabel="Englisch"
          targetLanguage="en"
        />
      ) : null}
      {deferredExample ? (
        <DeferredExampleControls
          onHide={() => setShowSession(false)}
          onResolve={() =>
            deferred.current?.resolve(
              preparedExamples(activeItems.map((item) => item.entryId)),
            )
          }
        />
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
