import type {
  PracticeSession,
  SubmitResult,
} from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import { ratings } from '../src/shared/grading/rating';

const millisecondsPerDay = 86_400_000;
const millisecondsPerSecond = 1000;
type FixtureCard = PracticeSession['items'][number];

const resolvedRating = (correct: boolean, corrected: boolean) => {
  if (correct) {
    return ratings.good;
  }
  return corrected ? ratings.hard : ratings.again;
};

export const gradeFixtureAnswer = (
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
