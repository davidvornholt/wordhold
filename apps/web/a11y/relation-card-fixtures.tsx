import type { LearnItem } from '../src/features/learning/schemas/learning-models';
import { LearnPass } from '../src/features/learning/ui/learn-pass';
import type { SubmitResult } from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import { directionLabel } from '../src/shared/directions';
import { withoutExamples } from '../src/shared/examples/example-model';
import { ratings } from '../src/shared/grading/rating';
import { CardRail } from '../src/shared/ui/card-rail';
import { FocusLayout } from '../src/shared/ui/focus-layout';
import { englishSubject } from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const synonyms = ['unfriendly', 'aggressive'];

const learnItem: LearnItem = {
  cardId: '00000000-0000-0000-0000-000000000061',
  direction: 'to_synonym',
  entryId: '00000000-0000-0000-0000-000000000062',
  targetText: 'hostile',
  nativeText: 'feindselig',
  relatedWords: synonyms,
  hasAudio: false,
  example: {
    targetText: 'The dog was hostile to strangers.',
    nativeText: 'Der Hund war Fremden gegenüber feindselig.',
    source: 'textbook',
    hasAudio: false,
  },
  textbookAnswers: synonyms,
  keyPoints: null,
};

const practiceItem = {
  cardId: learnItem.cardId,
  revision: 0,
  direction: 'to_synonym' as const,
  entryId: learnItem.entryId,
  targetText: learnItem.targetText,
  nativeText: learnItem.nativeText,
  relatedWords: synonyms,
  hasAudio: false,
  entryKnown: false,
  example: null,
  prompt: learnItem.targetText,
};

const backControl = fixtureBackControl('Unit 3 – Holidays', 'unit');

const oppositeGiven: SubmitResult = {
  graded: true,
  correct: false,
  stored: false,
  expectedAnswer: synonyms.join(', '),
  explanation: "'friendly' ist ein Gegenteil von 'hostile', kein Synonym.",
  acceptedAsAlternative: false,
  keyPoints: null,
  assessmentId: '00000000-0000-0000-0000-000000000063',
};

// The first answer gives the opposite; once one synonym has been copied, the
// card is stored as wrong.
const submitSynonym = ({
  data,
}: {
  readonly data: SubmitPayloadData;
}): Promise<SubmitResult> => {
  if (!('skipped' in data) && data.wrongAnswerResolution === 'defer') {
    return Promise.resolve(oppositeGiven);
  }
  return Promise.resolve({
    graded: true,
    correct: false,
    stored: true,
    revision: data.revision + 1,
    rating: ratings.again,
    expectedAnswer: oppositeGiven.expectedAnswer,
    explanation: null,
    acceptedAsAlternative: false,
    keyPoints: null,
    schedule: { advanced: true, state: 'relearning', dueAt: new Date() },
    entryKnown: false,
  });
};

export const SynonymLearnFixture = () => (
  <FocusLayout exit={backControl} title="Unit 3: Holidays · Kennenlernen">
    <LearnPass
      completionControls={fixtureControl(
        'Jetzt üben · Synonyme',
        'synonym-practice',
        'primary',
      )}
      directionLabel={directionLabel('to_synonym', englishSubject)}
      items={[learnItem]}
      onIntroduce={() => Promise.resolve()}
      subject={englishSubject}
    />
  </FocusLayout>
);

export const SynonymPracticeFixture = () => (
  <FocusLayout exit={backControl} title="English A2 · Üben">
    <CardRail
      activeIndex={0}
      activeOutcome={null}
      description="0 von 1 Karte bearbeitet"
      label="Abschnitt 1"
      ticks={[null]}
    />
    <CardPractice
      deck={0}
      item={practiceItem}
      mode="scheduled"
      onJudged={() => undefined}
      onNext={() => navigateToFixture('practice-empty')}
      prepareExamples={withoutExamples}
      repeated={false}
      subject={englishSubject}
      submit={submitSynonym}
    />
  </FocusLayout>
);
