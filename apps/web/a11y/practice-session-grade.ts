import type {
  PracticeSession,
  SubmitResult,
} from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import { ratings } from '../src/shared/grading/rating';

const millisecondsPerDay = 86_400_000;
const millisecondsPerSecond = 1000;
type FixtureCard = PracticeSession['items'][number];

// Answers the judge accepted earlier; they count as correct, but the feedback
// still names the textbook answer.
const learnedAlternatives: Readonly<Record<string, string>> = {
  memory: 'recollection',
};

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
      expectedAnswer: expected,
      explanation: null,
      acceptedAsAlternative: false,
      keyPoints: null,
      schedule: {
        advanced: true,
        state: 'relearning',
        dueAt: new Date(Date.now() - millisecondsPerSecond),
      },
      entryKnown: false,
    });
  }
  if (data.answer === 'ungraded') {
    return Promise.resolve({
      graded: false,
      expectedAnswer: expected,
      message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
    });
  }
  const correct =
    data.answer === expected || data.answer === learnedAlternatives[expected];
  if (!correct && data.wrongAnswerResolution === 'defer') {
    return Promise.resolve({
      graded: true,
      correct: false,
      stored: false,
      expectedAnswer: expected,
      explanation: null,
      acceptedAsAlternative: false,
      keyPoints: null,
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
    expectedAnswer: expected,
    explanation: null,
    acceptedAsAlternative: false,
    keyPoints: null,
    schedule: {
      advanced: scheduleAdvances,
      state: resolvedCorrect ? 'review' : 'relearning',
      dueAt: resolvedCorrect
        ? new Date(Date.now() + millisecondsPerDay)
        : new Date(Date.now() - millisecondsPerSecond),
    },
    // Each fixture entry is practised in one direction only.
    entryKnown: resolvedCorrect && scheduleAdvances,
  });
};
