import { sessionOptions } from '../src/features/practice/services/session-options';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { countNoun } from '../src/shared/format/count';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

export const StudyStartFixture = () => (
  <PageLayout
    backControl={fixtureBackControl('Unit 3 – Holidays', 'unit')}
    title="Unit 3 – Holidays üben"
  >
    <SessionStart
      itemNoun={{ singular: 'Karte', plural: 'Karten' }}
      options={sessionOptions(['to_target', 'to_native'], 'Englisch', [
        { direction: 'to_target', ready: 16 },
        { direction: 'to_native', ready: 16 },
        { direction: 'both', ready: 32 },
      ])}
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
  </PageLayout>
);
