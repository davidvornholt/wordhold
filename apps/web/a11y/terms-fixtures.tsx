import { useId } from 'react';
import type { LearnItem } from '../src/features/learning/schemas/learning-models';
import { LearnPass } from '../src/features/learning/ui/learn-pass';
import type { SubmitResult } from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import { FeedbackPanel } from '../src/features/practice/ui/feedback-panel';
import { directionLabel } from '../src/shared/directions';
import { withoutExamples } from '../src/shared/examples/example-model';
import { ratings } from '../src/shared/grading/rating';
import { CardRail } from '../src/shared/ui/card-rail';
import { FocusLayout } from '../src/shared/ui/focus-layout';
import { WordCard } from '../src/shared/ui/word-card';
import { termsSubject } from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const term = 'Katalysator';
const definition =
  'Ein Stoff, der die Aktivierungsenergie einer Reaktion senkt und dabei nicht verbraucht wird.';
const keyPoints = [
  'Ein Katalysator ist ein Stoff.',
  'Er senkt die Aktivierungsenergie einer Reaktion.',
  'Er wird bei der Reaktion nicht verbraucht.',
];

const backControl = fixtureBackControl('Chemie', 'terms-course');
const title = 'Chemie · Üben';

const learnItem: LearnItem = {
  cardId: '00000000-0000-0000-0000-000000000051',
  direction: 'to_native',
  entryId: '00000000-0000-0000-0000-000000000052',
  targetText: term,
  nativeText: definition,
  relatedWords: [],
  hasAudio: false,
  example: null,
  textbookAnswers: [],
  keyPoints,
};

const practiceItem = {
  cardId: learnItem.cardId,
  revision: 0,
  direction: 'to_native' as const,
  entryId: learnItem.entryId,
  targetText: term,
  nativeText: definition,
  relatedWords: [],
  hasAudio: false,
  entryKnown: false,
  example: null,
  prompt: term,
};

const missedPoint: SubmitResult = {
  graded: true,
  correct: false,
  stored: false,
  expectedAnswer: definition,
  explanation:
    'Du beschreibst die Wirkung richtig, aber nicht, dass der Stoff erhalten bleibt.',
  acceptedAsAlternative: false,
  keyPoints: [
    { text: keyPoints[0] ?? '', covered: true, note: null },
    { text: keyPoints[1] ?? '', covered: true, note: null },
    {
      text: keyPoints[2] ?? '',
      covered: false,
      note: 'Dass der Katalysator nicht verbraucht wird, fehlt.',
    },
  ],
  assessmentId: '00000000-0000-0000-0000-000000000053',
};

// The first answer misses a key point; once the definition has been copied,
// the card is stored as wrong.
const submitDefinition = ({
  data,
}: {
  readonly data: SubmitPayloadData;
}): Promise<SubmitResult> => {
  if (!('skipped' in data) && data.wrongAnswerResolution === 'defer') {
    return Promise.resolve(missedPoint);
  }
  return Promise.resolve({
    graded: true,
    correct: false,
    stored: true,
    revision: data.revision + 1,
    rating: ratings.again,
    expectedAnswer: missedPoint.expectedAnswer,
    explanation: null,
    acceptedAsAlternative: false,
    keyPoints: missedPoint.keyPoints,
    schedule: { advanced: true, state: 'relearning', dueAt: new Date() },
    entryKnown: false,
  });
};

const submittedAnswer =
  'Ein Stoff, der die Aktivierungsenergie einer Reaktion herabsetzt.';

export const TermsLearnFixture = () => (
  <FocusLayout exit={backControl} title="Chemie · Kennenlernen">
    <LearnPass
      completionControls={fixtureControl(
        'Jetzt üben · Begriff → Definition',
        'terms-practice',
        'primary',
      )}
      directionLabel={directionLabel('to_native', termsSubject)}
      items={[learnItem]}
      onIntroduce={() => Promise.resolve()}
      subject={termsSubject}
    />
  </FocusLayout>
);

export const TermsPracticeFixture = () => (
  <FocusLayout exit={backControl} title={title}>
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
      subject={termsSubject}
      submit={submitDefinition}
    />
  </FocusLayout>
);

export const TermsFeedbackFixture = () => {
  const promptId = useId();
  const feedbackId = useId();
  return (
    <FocusLayout exit={backControl} title={title}>
      <WordCard
        deck={0}
        eyebrow="Erkläre den Begriff"
        tone="destructive"
        word={term}
        wordId={promptId}
        wordLang="de"
      >
        <FeedbackPanel
          answerLanguage="de"
          busy={false}
          dictated={false}
          example={null}
          id={feedbackId}
          kind="terms"
          playSentence={null}
          playWord={null}
          repeated={false}
          result={missedPoint}
          skipped={false}
          submittedAnswer={submittedAnswer}
          targetLanguage="de"
        />
      </WordCard>
    </FocusLayout>
  );
};
