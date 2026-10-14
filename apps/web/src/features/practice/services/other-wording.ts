import { isOtherWording } from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { isDeterministicMatch } from '../../../shared/grading/deterministic-match';
import type {
  CourseEntryPlace,
  OtherWordingResult,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { AnsweredSubmitData } from '../schemas/submission-schema';
import type { AssessedAnswer } from './answer-assessment';
import type { PracticeReviewStore } from './review-store';

// A vocabulary test asks for the textbook's word, but a complete translation
// in other words shows the task was understood. Into the target language of a
// language course, such an answer is not a miss: the card stays open for
// another try. Resolving an earlier rejection never reopens the card.
export const allowsAnotherTry = (
  row: SubmissionRecord,
  data: AnsweredSubmitData,
  assessed: AssessedAnswer,
): boolean =>
  data.wrongAnswerResolution === 'defer' &&
  row.courseKind === 'language' &&
  row.card.direction === 'to_target' &&
  assessed.outcome.method === 'judge' &&
  isOtherWording(assessed.outcome.verdict);

// The entry of the course the answer spells out, read in textbook notation so
// 'concentrarse en algo' finds 'concentrarse (en algo)'. The first one the
// books teach wins.
export const findCourseEntry = (
  answer: string,
  entries: ReadonlyArray<CourseEntryPlace>,
): CourseEntryPlace | null =>
  entries.find((entry) =>
    isDeterministicMatch(answer, [{ text: entry.text, source: 'textbook' }]),
  ) ?? null;

export const otherWordingResult = (
  reviews: PracticeReviewStore['Service'],
  row: SubmissionRecord,
  answer: string,
) =>
  reviews.listCourseEntries(row.entry.id).pipe(
    Effect.map(
      (entries): OtherWordingResult => ({
        otherWording: true,
        courseEntry: findCourseEntry(answer, entries),
      }),
    ),
  );
