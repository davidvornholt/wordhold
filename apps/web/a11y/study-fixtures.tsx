import { sessionOptions } from '../src/features/practice/services/session-options';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { UnlearnedNotice } from '../src/features/practice/ui/unlearned-notice';
import { countNoun } from '../src/shared/format/count';
import { Button } from '../src/shared/ui/button';
import { FocusLayout } from '../src/shared/ui/focus-layout';
import { englishSubject } from './course-fixture-data';
import { fixtureBackControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

// Without `unlearned`, a unit whose words are all learned. With it, two
// words picked in the list, one of them learned only one way round.
export const StudyStartFixture = ({
  unlearned = false,
}: {
  readonly unlearned?: boolean;
}) => (
  <FocusLayout
    exit={
      unlearned
        ? fixtureBackControl('Vokabelliste', 'vocabulary')
        : fixtureBackControl('Unit 3 – Holidays', 'unit')
    }
    title={unlearned ? 'Auswahl · Üben' : 'Unit 3 – Holidays · Üben'}
  >
    {unlearned ? (
      <UnlearnedNotice
        learnAction={
          <Button
            onClick={() => navigateToFixture('learn-start')}
            variant="outline"
          >
            Auswahl kennenlernen
          </Button>
        }
        practisable={true}
        unlearned={1}
      />
    ) : null}
    <SessionStart
      itemNoun={{ singular: 'Karte', plural: 'Karten' }}
      options={sessionOptions(
        ['to_target', 'to_native'],
        englishSubject,
        unlearned
          ? [
              { direction: 'to_target', ready: 2 },
              { direction: 'to_native', ready: 1 },
              { direction: 'both', ready: 3 },
            ]
          : [
              { direction: 'to_target', ready: 16 },
              { direction: 'to_native', ready: 16 },
              { direction: 'both', ready: 32 },
            ],
      )}
      preferenceKey="english-a2:study"
      renderStartAction={(option, rememberDirection) => (
        <Button
          className="w-fit"
          onClick={() => {
            rememberDirection();
            navigateToFixture('study-session');
          }}
        >
          {countNoun(option.cards, 'Karte', 'Karten')} starten
        </Button>
      )}
    />
  </FocusLayout>
);
