import { Effect } from 'effect';
import type { AssessedGradeOutcome } from '../../../shared/grading/rating';
import { englishNames } from '../../../shared/languages';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import type { SubmissionRecord } from '../schemas/practice-models';
import type { AnsweredSubmitData } from '../schemas/submission-schema';
import {
  type AcceptedAnswer,
  isDeterministicMatch,
} from './deterministic-grading';
import { judgeWithCache } from './judge-cache';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';

export type AssessedAnswer =
  | {
      readonly outcome: { readonly method: 'exact' };
      readonly assessmentId: null;
    }
  | {
      readonly outcome: AssessedGradeOutcome & { readonly method: 'judge' };
      readonly assessmentId: string;
    };

type GradeAnswerInput = {
  readonly row: SubmissionRecord;
  readonly accepted: ReadonlyArray<AcceptedAnswer>;
  readonly data: AnsweredSubmitData;
  readonly normalized: string;
  readonly cache: JudgeCacheStore['Type'];
  readonly judge: PracticeJudge['Type'];
};

export const gradeAnswer = ({
  row,
  accepted,
  data,
  normalized,
  cache,
  judge,
}: GradeAnswerInput) => {
  if (isDeterministicMatch(data.answer, accepted)) {
    return Effect.succeed<AssessedAnswer>({
      outcome: { method: 'exact' },
      assessmentId: null,
    });
  }
  return judgeWithCache({
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
    Effect.provideService(JudgeCacheStore, cache),
    Effect.provideService(PracticeJudge, judge),
    Effect.catchTag('PracticeJudgeError', () => Effect.succeed(null)),
  );
};

type LoadRejectedAssessmentInput = {
  readonly row: SubmissionRecord;
  readonly normalized: string;
  readonly assessmentId: string;
  readonly cache: JudgeCacheStore['Type'];
};

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
      Effect.flatMap((cached) => {
        if (cached === undefined || cached.verdict.correct) {
          return Effect.fail(
            new StaleAnswerSubmissionError({
              message:
                'Die ursprüngliche Bewertung ist nicht mehr verfügbar. Lade die Übung neu.',
            }),
          );
        }
        return Effect.succeed<AssessedAnswer>({
          outcome: { method: 'judge', verdict: cached.verdict },
          assessmentId: cached.assessmentId,
        });
      }),
    );
