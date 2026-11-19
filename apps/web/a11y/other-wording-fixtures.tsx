import type {
  CourseEntryPlace,
  SubmitResult,
} from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import type { CourseSubject } from '../src/shared/directions';
import { withoutExamples } from '../src/shared/examples/example-model';
import { isDeterministicMatch } from '../src/shared/grading/deterministic-match';
import { ratings } from '../src/shared/grading/rating';
import { CardRail } from '../src/shared/ui/card-rail';
import { FocusLayout } from '../src/shared/ui/focus-layout';
import { fixtureBackControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const spanishSubject: CourseSubject = {
  kind: 'language',
  targetLanguage: 'es',
};

const textbookAnswer = 'enfocarse en algo';

const practiceItem = {
  cardId: '00000000-0000-0000-0000-000000000071',
  revision: 0,
  direction: 'to_target' as const,
  entryId: '00000000-0000-0000-0000-000000000072',
  targetText: textbookAnswer,
  nativeText: 'sich auf etw. konzentrieren',
  relatedWords: [],
  hasAudio: false,
  entryKnown: false,
  example: null,
  prompt: 'sich auf etw. konzentrieren',
  spellingPitfalls: null,
};

// The other words of the course, as the server looks them up.
const courseEntries: ReadonlyArray<CourseEntryPlace> = [
  {
    text: 'concentrarse (en algo)',
    place: 'U5 Y después del instituto, ¿qué? / ¡Acércate!',
  },
];

// Correct translations the judge finds in other words than the book's.
const otherWordings = ['concentrarse en algo', 'centrarse en algo'];

const matches = (answer: string, text: string) =>
  isDeterministicMatch(answer, [{ text, source: 'textbook' }]);

// Another wording fails intendedConstruction, so it is rated hard.
const storedRating = (correct: boolean, otherWording: boolean) => {
  if (!correct) {
    return ratings.again;
  }
  return otherWording ? ratings.hard : ratings.good;
};

const storedResult = (
  correct: boolean,
  revision: number,
  otherWording = false,
): SubmitResult => ({
  graded: true,
  correct,
  stored: true,
  revision: revision + 1,
  rating: storedRating(correct, otherWording),
  expectedAnswer: textbookAnswer,
  explanation: null,
  acceptedAsAlternative: false,
  keyPoints: null,
  schedule: correct
    ? { advanced: true, state: 'review', dueAt: new Date() }
    : { advanced: true, state: 'relearning', dueAt: new Date() },
  entryKnown: false,
});

// The book's word is right. Practice for a test leaves another wording open
// and names the course entry it spells out, if any; other practice counts it
// as right. Anything else is a miss.
const submitTranslation =
  (testPractice: boolean) =>
  ({ data }: { readonly data: SubmitPayloadData }): Promise<SubmitResult> => {
    if ('skipped' in data || data.wrongAnswerResolution !== 'defer') {
      return Promise.resolve(storedResult(false, data.revision));
    }
    const { answer } = data;
    if (matches(answer, textbookAnswer)) {
      return Promise.resolve(storedResult(true, data.revision));
    }
    if (!otherWordings.some((wording) => matches(answer, wording))) {
      return Promise.resolve({
        graded: true,
        correct: false,
        stored: false,
        expectedAnswer: textbookAnswer,
        explanation: null,
        acceptedAsAlternative: false,
        keyPoints: null,
        assessmentId: '00000000-0000-0000-0000-000000000073',
      });
    }
    if (!testPractice) {
      return Promise.resolve(storedResult(true, data.revision, true));
    }
    const matched = courseEntries.find((entry) => matches(answer, entry.text));
    return Promise.resolve({
      otherWording: true,
      courseEntry: matched ? { text: answer, place: matched.place } : null,
    });
  };

// A test's missed words, or a unit's scheduled review.
export const OtherWordingFixture = ({
  testPractice,
}: {
  readonly testPractice: boolean;
}) => (
  <FocusLayout
    exit={
      testPractice
        ? fixtureBackControl('Test', 'exam')
        : fixtureBackControl('U1 ¡Bienvenidos!', 'unit')
    }
    title={testPractice ? 'Test · Üben' : 'Spanisch · Üben'}
  >
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
      mode={testPractice ? 'drill' : 'scheduled'}
      onJudged={() => undefined}
      onNext={() => navigateToFixture('practice-empty')}
      prepareExamples={withoutExamples}
      repeated={false}
      subject={spanishSubject}
      submit={submitTranslation(testPractice)}
    />
  </FocusLayout>
);
