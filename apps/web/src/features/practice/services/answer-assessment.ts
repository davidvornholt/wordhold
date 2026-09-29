import { isDefinitionCorrect } from '@wordhold/ai/definition/schema';
import { Effect } from 'effect';
import type { AssessedGradeOutcome } from '../../../shared/grading/rating';
import { englishNames } from '../../../shared/languages';
import {
  type PracticeDatabaseError,
  type PracticeJudgeError,
  StaleAnswerSubmissionError,
} from '../errors/practice-errors';
import type { SubmissionRecord } from '../schemas/practice-models';
import type { AnsweredSubmitData } from '../schemas/submission-schema';
import { DefinitionGrader } from './definition-grader';
import {
  type AcceptedAnswer,
  isDeterministicMatch,
} from './deterministic-grading';
import {
  isDefinitionVerdict,
  isTranslationVerdict,
  judgeDefinitionWithCache,
  judgeWithCache,
} from './judge-cache';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import type { PracticeReviewStore } from './review-store';

export type AssessedAnswer =
  | {
      readonly outcome: { readonly method: 'exact' };
      readonly assessmentId: null;
    }
  | {
      readonly outcome: Exclude<
        AssessedGradeOutcome,
        { readonly method: 'exact' }
      >;
      readonly assessmentId: string;
    };

type GradeAnswerInput = {
  readonly row: SubmissionRecord;
  readonly accepted: ReadonlyArray<AcceptedAnswer>;
  readonly data: AnsweredSubmitData;
  readonly normalized: string;
  readonly reviews: PracticeReviewStore['Type'];
  readonly cache: JudgeCacheStore['Type'];
  readonly judge: PracticeJudge['Type'];
  readonly grader: DefinitionGrader['Type'];
};

const gradeTranslation = ({
  row,
  accepted,
  data,
  normalized,
}: GradeAnswerInput) =>
  judgeWithCache({
    entryId: row.entry.id,
    direction: row.card.direction,
    normalizedAnswer: normalized,
    input: {
      direction: row.card.direction,
      targetLanguage: englishNames[row.targetLanguage],
      prompt:
        row.card.direction === 'to_target'
          ? row.entry.nativeText
          : row.entry.targetText,
      expectedAnswers: accepted.map((answer) => answer.text),
      givenAnswer: data.answer,
    },
  }).pipe(
    Effect.map(
      ({ assessmentId, verdict }): AssessedAnswer => ({
        outcome: { method: 'judge', verdict },
        assessmentId,
      }),
    ),
  );

// A term saved before its key points could be derived gets them on its first
// graded answer. They are stored only while the definition is still the one
// they were derived from.
const definitionKeyPoints = ({ row, reviews, grader }: GradeAnswerInput) =>
  row.entry.keyPoints === null
    ? grader
        .keyPoints({
          term: row.entry.targetText,
          definition: row.entry.nativeText,
        })
        .pipe(
          Effect.tap((keyPoints) =>
            reviews.saveKeyPoints(
              row.entry.id,
              row.entry.nativeText,
              keyPoints,
            ),
          ),
        )
    : Effect.succeed(row.entry.keyPoints);

const gradeDefinition = (input: GradeAnswerInput) =>
  Effect.gen(function* () {
    const { row, data, normalized } = input;
    const keyPoints = yield* definitionKeyPoints(input);
    const { assessmentId, verdict } = yield* judgeDefinitionWithCache({
      entryId: row.entry.id,
      direction: row.card.direction,
      normalizedAnswer: normalized,
      input: {
        term: row.entry.targetText,
        definition: row.entry.nativeText,
        keyPoints,
        givenAnswer: data.answer,
      },
    });
    return {
      outcome: { method: 'definition', keyPoints, verdict },
      assessmentId,
    } satisfies AssessedAnswer;
  });

// Null when the judge could not be reached: the answer stays ungraded and the
// card untouched.
export const gradeAnswer = (input: GradeAnswerInput) => {
  if (isDeterministicMatch(input.data.answer, input.accepted)) {
    return Effect.succeed<AssessedAnswer>({
      outcome: { method: 'exact' },
      assessmentId: null,
    });
  }
  const graded: Effect.Effect<
    AssessedAnswer,
    PracticeDatabaseError | PracticeJudgeError,
    JudgeCacheStore | PracticeJudge | DefinitionGrader
  > =
    input.row.courseKind === 'terms'
      ? gradeDefinition(input)
      : gradeTranslation(input);
  return graded.pipe(
    Effect.provideService(JudgeCacheStore, input.cache),
    Effect.provideService(PracticeJudge, input.judge),
    Effect.provideService(DefinitionGrader, input.grader),
    Effect.catchTag('PracticeJudgeError', () => Effect.succeed(null)),
  );
};

type LoadRejectedAssessmentInput = {
  readonly row: SubmissionRecord;
  readonly normalized: string;
  readonly assessmentId: string;
  readonly cache: JudgeCacheStore['Type'];
};

const staleAssessment = () =>
  new StaleAnswerSubmissionError({
    message:
      'Die ursprüngliche Bewertung ist nicht mehr verfügbar. Lade die Übung neu.',
  });

export const loadRejectedAssessment = ({
  row,
  normalized,
  assessmentId,
  cache,
}: LoadRejectedAssessmentInput) =>
  cache
    .read(
      {
        entryId: row.entry.id,
        direction: row.card.direction,
        normalizedAnswer: normalized,
      },
      { assessmentId },
    )
    .pipe(
      Effect.flatMap(
        (cached): Effect.Effect<AssessedAnswer, StaleAnswerSubmissionError> => {
          if (cached === undefined) {
            return Effect.fail(staleAssessment());
          }
          const { verdict } = cached;
          if (row.courseKind === 'terms') {
            // The key points may have been edited since; a verdict that no
            // longer lines up with them cannot be committed.
            const { keyPoints } = row.entry;
            if (
              !isDefinitionVerdict(verdict) ||
              keyPoints === null ||
              verdict.keyPoints.length !== keyPoints.length ||
              isDefinitionCorrect(verdict)
            ) {
              return Effect.fail(staleAssessment());
            }
            return Effect.succeed({
              outcome: { method: 'definition', keyPoints, verdict },
              assessmentId: cached.assessmentId,
            });
          }
          if (!isTranslationVerdict(verdict) || verdict.correct) {
            return Effect.fail(staleAssessment());
          }
          return Effect.succeed({
            outcome: { method: 'judge', verdict },
            assessmentId: cached.assessmentId,
          });
        },
      ),
    );
