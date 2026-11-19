import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import type {
  CachedVerdict,
  CourseEntryPlace,
  PersistReviewInput,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import type { JudgeCacheStore } from './judge-cache-store';
import {
  persistedReview,
  runSubmitPayload,
  testCard,
  testJudge,
  testSubmission,
} from './practice-service-test-support';
import type { PracticeReviewStore } from './review-store';

const spanishCard: SubmissionRecord = {
  ...testSubmission,
  entry: {
    ...testSubmission.entry,
    targetText: 'enfocarse en algo',
    nativeText: 'sich auf etw. konzentrieren',
  },
  targetLanguage: 'es',
};

const passing = { ok: true, note: null } as const;

const otherWording: JudgeVerdictData = {
  correct: false,
  acceptAsAlternative: false,
  otherWording: true,
  meaning: passing,
  grammar: passing,
  idiomaticity: passing,
  spelling: passing,
  intendedConstruction: { ok: false, note: 'Im Buch steht ein anderes Wort.' },
  explanation: "Gesucht ist 'enfocarse en algo'.",
};

const unit5 = 'U5 Y después del instituto, ¿qué? / ¡Acércate!';
const courseEntries: ReadonlyArray<CourseEntryPlace> = [
  { text: 'prestar atención (a algo)', place: 'U3 Mi barrio' },
  { text: 'concentrarse (en algo)', place: unit5 },
  { text: 'cell phone / mobile phone', place: 'U2 Communication' },
];

type Calls = { commits: number; lookups: number; judged: number };

const freshCalls = (): Calls => ({ commits: 0, lookups: 0, judged: 0 });

// The test of the card's course; any other id names a test elsewhere.
const courseExamId = '00000000-0000-0000-0000-000000000006';
const roundId = '00000000-0000-0000-0000-000000000007';

const reviewStore = (
  row: SubmissionRecord,
  calls: Calls,
  committed: Array<PersistReviewInput>,
): PracticeReviewStore['Service'] => ({
  findSubmission: (_cardId, _revision, examId) =>
    Effect.succeed({ ...row, examInCourse: examId === courseExamId }),
  listCourseEntries: (entryId) =>
    Effect.sync(() => {
      calls.lookups += 1;
      return entryId === row.entry.id ? courseEntries : [];
    }),
  saveKeyPoints: (_entryId, _definition, points) => Effect.succeed(points),
  listAcceptedAnswers: () =>
    Effect.succeed([{ text: row.entry.targetText, source: 'textbook' }]),
  commit: (input) =>
    Effect.sync(() => {
      calls.commits += 1;
      committed.push(input);
      return persistedReview;
    }),
});

const judgeReturning = (verdict: JudgeVerdictData, calls: Calls) =>
  testJudge(() =>
    Effect.sync(() => {
      calls.judged += 1;
      return { verdict, model: 'vertex:test-model' };
    }),
  );

// Keeps verdicts as the database does: by answer, read back by model
// identity or by assessment.
const memoryCache = (): JudgeCacheStore['Service'] => {
  const rows = new Map<string, CachedVerdict>();
  const keyOf = (key: Parameters<JudgeCacheStore['Service']['read']>[0]) =>
    `${key.entryId}:${key.direction}:${key.normalizedAnswer}`;
  return {
    read: (key, selector) =>
      Effect.sync(() => {
        const row = rows.get(keyOf(key));
        const selected =
          'model' in selector
            ? row?.model === selector.model
            : row?.assessmentId === selector.assessmentId;
        return selected ? row : undefined;
      }),
    write: (key, value) =>
      Effect.sync(() => {
        rows.set(keyOf(key), value);
      }),
    withCriticalSection: (_key, effect) => effect,
  };
};

type FirstAnswer = Extract<
  SubmitPayloadData,
  { readonly wrongAnswerResolution: 'defer' }
>;

const answer = (text: string): FirstAnswer => ({
  cardId: testCard.id,
  revision: testCard.revision,
  answer: text,
  dictated: false,
  elapsedMs: 4000,
  wrongAnswerResolution: 'defer',
  mode: 'scheduled',
});

const inRound = (text: string): FirstAnswer => ({
  ...answer(text),
  mode: 'drill',
  examRoundId: roundId,
});

// A sitting opened from a test's page, such as its missed words.
const forExam = (text: string, examId = courseExamId): FirstAnswer => ({
  ...answer(text),
  mode: 'drill',
  examId,
});

type SubmitOptions = {
  readonly row?: SubmissionRecord;
  readonly verdict?: JudgeVerdictData;
  readonly calls?: Calls;
  readonly cache?: JudgeCacheStore['Service'];
  readonly committed?: Array<PersistReviewInput>;
};

// A Spanish card into the target language whose judge finds other wording,
// unless a test says otherwise.
const submitWith = async (
  payload: SubmitPayloadData,
  {
    row = spanishCard,
    verdict = otherWording,
    calls = freshCalls(),
    cache = memoryCache(),
    committed = [],
  }: SubmitOptions = {},
) => {
  const result = await runSubmitPayload(
    reviewStore(row, calls, committed),
    judgeReturning(verdict, calls),
    payload,
    { cache },
  );
  return result._tag === 'Success' ? result.success : result.failure;
};

describe('PracticeService answer in other wording in test practice', () => {
  it('leaves the card open and names the course entry the answer spells out', async () => {
    const calls = freshCalls();
    const result = await submitWith(inRound('concentrarse en algo'), { calls });
    // Nothing about the book's word: no expected answer, no explanation.
    expect(result).toEqual({
      otherWording: true,
      courseEntry: { text: 'concentrarse en algo', place: unit5 },
    });
    expect(calls).toEqual({ commits: 0, lookups: 1, judged: 1 });
  });

  it('does not reveal the solution through another course entry', async () => {
    const result = await submitWith(inRound('cell phone'), {
      row: {
        ...testSubmission,
        entry: {
          ...testSubmission.entry,
          targetText: 'mobile phone',
          nativeText: 'Handy',
        },
        targetLanguage: 'en',
      },
      verdict: { ...otherWording, explanation: "Gesucht ist 'mobile phone'." },
    });
    expect(result).toEqual({
      otherWording: true,
      courseEntry: { text: 'cell phone', place: 'U2 Communication' },
    });
  });

  it('names no entry for a wording the course does not teach', async () => {
    expect(await submitWith(inRound('centrarse en algo'))).toEqual({
      otherWording: true,
      courseEntry: null,
    });
  });

  it('leaves the card open in a sitting for a test of the course', async () => {
    const calls = freshCalls();
    expect(
      await submitWith(forExam('concentrarse en algo'), { calls }),
    ).toEqual({
      otherWording: true,
      courseEntry: { text: 'concentrarse en algo', place: unit5 },
    });
    expect(calls.commits).toBe(0);
  });

  it('asks the judge once for the same wording typed again', async () => {
    const options = { calls: freshCalls(), cache: memoryCache() };
    const first = await submitWith(inRound('concentrarse en algo'), options);
    const again = await submitWith(inRound('concentrarse en algo'), options);
    expect(again).toEqual(first);
    expect(options.calls).toEqual({ commits: 0, lookups: 2, judged: 1 });
  });

  it('grades the next try like a first answer', async () => {
    const options = { calls: freshCalls(), cache: memoryCache() };
    await submitWith(inRound('concentrarse en algo'), options);
    const result = await submitWith(inRound('enfocarse en algo'), options);
    expect(result).toMatchObject({
      graded: true,
      correct: true,
      stored: true,
      rating: ratings.good,
    });
    expect(options.calls).toEqual({ commits: 1, lookups: 1, judged: 1 });
  });
});

describe('PracticeService answer in other wording outside test practice', () => {
  it('counts a scheduled answer as right without accepting its wording', async () => {
    const calls = freshCalls();
    const committed: Array<PersistReviewInput> = [];
    const result = await submitWith(answer('concentrarse en algo'), {
      calls,
      committed,
    });
    // The judge's explanation rejects the answer, so none is shown.
    expect(result).toEqual({
      graded: true,
      correct: true,
      stored: true,
      revision: persistedReview.revision,
      rating: ratings.hard,
      expectedAnswer: 'enfocarse en algo',
      explanation: null,
      acceptedAsAlternative: false,
      acceptedAsOtherWording: true,
      keyPoints: null,
      schedule: persistedReview.schedule,
      entryKnown: false,
    });
    expect(committed).toMatchObject([
      {
        rating: ratings.hard,
        answer: 'concentrarse en algo',
        outcome: { method: 'other-wording', verdict: otherWording },
        examRoundId: null,
      },
    ]);
    expect(calls).toEqual({ commits: 1, lookups: 0, judged: 1 });
  });

  it.each([
    ['free practice', { ...answer('concentrarse en algo'), mode: 'drill' }],
    [
      'a sitting for a test of another course',
      forExam('concentrarse en algo', '00000000-0000-0000-0000-000000000008'),
    ],
  ] as const)('counts it as right in %s', async (_case, payload) => {
    const committed: Array<PersistReviewInput> = [];
    expect(await submitWith(payload, { committed })).toMatchObject({
      correct: true,
      stored: true,
      acceptedAsOtherWording: true,
    });
    expect(committed.map((input) => input.outcome.method)).toEqual([
      'other-wording',
    ]);
  });

  it('marks no other answer as another wording', async () => {
    expect(await submitWith(answer('enfocarse en algo'))).toMatchObject({
      correct: true,
      acceptedAsOtherWording: false,
    });
  });
});

describe('PracticeService miss despite other wording', () => {
  it('holds back an incomplete answer as a miss', async () => {
    const calls = freshCalls();
    const result = await submitWith(answer('concentrarse'), {
      verdict: { ...otherWording, otherWording: false },
      calls,
    });
    expect(result).toMatchObject({
      graded: true,
      correct: false,
      stored: false,
      expectedAnswer: 'enfocarse en algo',
    });
    expect(calls).toEqual({ commits: 0, lookups: 0, judged: 1 });
  });

  it('keeps an answer into German in other wording a miss', async () => {
    const calls = freshCalls();
    const result = await submitWith(answer('sich fokussieren'), {
      row: { ...spanishCard, card: { ...testCard, direction: 'to_native' } },
      calls,
    });
    expect(result).toMatchObject({ graded: true, stored: false });
    expect(calls.lookups).toBe(0);
  });

  it('stores a rejection the learner resolves, whatever its wording', async () => {
    const options = { calls: freshCalls(), cache: memoryCache() };
    const assessmentId = '00000000-0000-0000-0000-000000000003';
    await Effect.runPromise(
      options.cache.write(
        {
          entryId: spanishCard.entry.id,
          direction: 'to_target',
          normalizedAnswer: 'concentrarse en algo',
        },
        { assessmentId, verdict: otherWording, model: 'vertex:old-prompt' },
      ),
    );
    const result = await submitWith(
      {
        ...answer('concentrarse en algo'),
        wrongAnswerResolution: 'again',
        assessmentId,
      },
      options,
    );
    expect(result).toMatchObject({
      graded: true,
      correct: false,
      stored: true,
      rating: ratings.again,
    });
    expect(options.calls).toEqual({ commits: 1, lookups: 0, judged: 0 });
  });
});
