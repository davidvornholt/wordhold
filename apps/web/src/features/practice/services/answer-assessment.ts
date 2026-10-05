import { isDefinitionCorrect } from '@wordhold/ai/definition/schema';
import type { AiUsage } from '@wordhold/ai/usage';
import { Effect } from 'effect';
import {
  type AcceptedAnswer,
  isDeterministicMatch,
} from '../../../shared/grading/deterministic-match';
import {
  type AssessedGradeOutcome,
  gradeRecitation,
  type RecitationOutcome,
} from '../../../shared/grading/rating';
import { englishNames } from '../../../shared/languages';
import {
  type PracticeDatabaseError,
  type PracticeJudgeError,
  StaleAnswerSubmissionError,
} from '../errors/practice-errors';
import type {
  CachedVerdict,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { AnsweredSubmitData } from '../schemas/submission-schema';
import { DefinitionGrader } from './definition-grader';
import {
  definitionCacheIdentity,
  isDefinitionVerdict,
  isTranslationVerdict,
  judgeDefinitionWithCache,
  judgeWithCache,
} from './judge-cache';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import type { PracticeReviewStore } from './review-store';

// Only a judge verdict is cached and can be overruled later, so only a judge
// verdict has an assessment.
export type AssessedAnswer =
  | {
      readonly outcome: { readonly method: 'exact' } | RecitationOutcome;
      readonly assessmentId: null;
    }
  | {
      readonly outcome: Exclude<
        AssessedGradeOutcome,
        { readonly method: 'exact' | 'recitation' }
      >;
      readonly assessmentId: string;
    };

type GradeAnswerInput = {
  readonly row: SubmissionRecord;
  readonly accepted: ReadonlyArray<AcceptedAnswer>;
  readonly data: AnsweredSubmitData;
  readonly normalized: string;
  readonly reviews: PracticeReviewStore['Service'];
  readonly cache: JudgeCacheStore['Service'];
  readonly judge: PracticeJudge['Service'];
  readonly grader: DefinitionGrader['Service'];
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
// they were derived from. When another answer stored its own first, the
// answer is graded against those, so every verdict matches the entry.
const definitionKeyPoints = ({ row, reviews, grader }: GradeAnswerInput) =>
  row.entry.keyPoints === null
    ? grader
        .keyPoints({
          term: row.entry.targetText,
          definition: row.entry.nativeText,
        })
        .pipe(
          Effect.flatMap((derived) =>
            reviews
              .saveKeyPoints(row.entry.id, row.entry.nativeText, derived)
              .pipe(Effect.map((stored) => stored ?? derived)),
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
// card untouched. A text learned by heart is compared word for word and never
// reaches the judge, since only its exact wording counts.
export const gradeAnswer = (input: GradeAnswerInput) => {
  if (input.row.courseKind === 'texts') {
    return Effect.succeed<AssessedAnswer>({
      outcome: gradeRecitation(input.row.entry.nativeText, input.data.answer, {
        dictated: input.data.dictated,
      }),
      assessmentId: null,
    });
  }
  if (isDeterministicMatch(input.data.answer, input.accepted)) {
    return Effect.succeed<AssessedAnswer>({
      outcome: { method: 'exact' },
      assessmentId: null,
    });
  }
  const graded: Effect.Effect<
    AssessedAnswer,
    PracticeDatabaseError | PracticeJudgeError,
    JudgeCacheStore | PracticeJudge | DefinitionGrader | AiUsage
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
  // The answer as typed, which a definition verdict was judged on.
  readonly answer: string;
  readonly normalized: string;
  readonly assessmentId: string;
  readonly cache: JudgeCacheStore['Service'];
  readonly grader: DefinitionGrader['Service'];
};

const staleAssessment = () =>
  new StaleAnswerSubmissionError({
    message:
      'Die ursprüngliche Bewertung ist nicht mehr verfügbar. Lade die Übung neu.',
  });

// The key points may have been edited since. Only a verdict whose cache
// identity matches the entry's current key points and this answer can be
// committed; comparing the number of points would let an edit through.
const rejectedDefinition = (
  { row, answer, grader }: LoadRejectedAssessmentInput,
  cached: CachedVerdict,
) =>
  Effect.gen(function* () {
    const { keyPoints } = row.entry;
    const { verdict } = cached;
    if (
      keyPoints === null ||
      !isDefinitionVerdict(verdict) ||
      isDefinitionCorrect(verdict)
    ) {
      return yield* staleAssessment();
    }
    const identity = yield* Effect.promise(() =>
      definitionCacheIdentity(grader.model, {
        term: row.entry.targetText,
        definition: row.entry.nativeText,
        keyPoints,
        givenAnswer: answer,
      }),
    );
    if (cached.model !== identity) {
      return yield* staleAssessment();
    }
    return {
      outcome: { method: 'definition', keyPoints, verdict },
      assessmentId: cached.assessmentId,
    } satisfies AssessedAnswer;
  });

const rejectedTranslation = (
  cached: CachedVerdict,
): Effect.Effect<AssessedAnswer, StaleAnswerSubmissionError> => {
  const { verdict } = cached;
  if (!isTranslationVerdict(verdict) || verdict.correct) {
    return Effect.fail(staleAssessment());
  }
  return Effect.succeed({
    outcome: { method: 'judge', verdict },
    assessmentId: cached.assessmentId,
  });
};

export const loadRejectedAssessment = (input: LoadRejectedAssessmentInput) =>
  input.cache
    .read(
      {
        entryId: input.row.entry.id,
        direction: input.row.card.direction,
        normalizedAnswer: input.normalized,
      },
      { assessmentId: input.assessmentId },
    )
    .pipe(
      Effect.flatMap(
        (cached): Effect.Effect<AssessedAnswer, StaleAnswerSubmissionError> => {
          if (cached === undefined) {
            return Effect.fail(staleAssessment());
          }
          switch (input.row.courseKind) {
            case 'terms':
              return rejectedDefinition(input, cached);
            case 'language':
              return rejectedTranslation(cached);
            case 'texts':
              return Effect.fail(staleAssessment());
            default:
              return input.row.courseKind satisfies never;
          }
        },
      ),
    );
