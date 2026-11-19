import {
  isOtherWording,
  type JudgeVerdictData,
} from '@wordhold/ai/judge/schema';
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

// The verdict of a complete, correct translation into the target language
// of a language course in other words than the textbook's, or null. Resolving
// an earlier rejection leaves the rejection as it was.
export const otherWordingVerdict = (
  row: SubmissionRecord,
  data: AnsweredSubmitData,
  { outcome }: AssessedAnswer,
): JudgeVerdictData | null =>
  data.wrongAnswerResolution === 'defer' &&
  row.courseKind === 'language' &&
  row.card.direction === 'to_target' &&
  outcome.method === 'judge' &&
  isOtherWording(outcome.verdict)
    ? outcome.verdict
    : null;

// A vocabulary test asks for the textbook's word, so practice for a test
// keeps the card open for another try. Any other practice counts such an
// answer as right.
export const isTestPractice = (
  row: SubmissionRecord,
  data: AnsweredSubmitData,
): boolean => data.examRoundId !== undefined || row.examInCourse;

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
    Effect.map((entries): OtherWordingResult => {
      const matched = findCourseEntry(answer, entries);
      return {
        otherWording: true,
        courseEntry: matched ? { text: answer, place: matched.place } : null,
      };
    }),
  );
