import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import type {
  CachedVerdict,
  CourseEntryPlace,
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

const reviewStore = (
  row: SubmissionRecord,
  calls: Calls,
): PracticeReviewStore['Service'] => ({
  findSubmission: () => Effect.succeed(row),
  listCourseEntries: (entryId) =>
    Effect.sync(() => {
      calls.lookups += 1;
      return entryId === row.entry.id ? courseEntries : [];
    }),
  saveKeyPoints: (_entryId, _definition, points) => Effect.succeed(points),
  listAcceptedAnswers: () =>
    Effect.succeed([{ text: row.entry.targetText, source: 'textbook' }]),
  commit: () =>
    Effect.sync(() => {
      calls.commits += 1;
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

type SubmitOptions = {
  readonly row?: SubmissionRecord;
  readonly verdict?: JudgeVerdictData;
  readonly calls?: Calls;
  readonly cache?: JudgeCacheStore['Service'];
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
  }: SubmitOptions = {},
) => {
  const result = await runSubmitPayload(
    reviewStore(row, calls),
    judgeReturning(verdict, calls),
    payload,
    { cache },
  );
  return result._tag === 'Success' ? result.success : result.failure;
};

describe('PracticeService answer in other wording', () => {
  it('leaves the card open and names the course entry the answer spells out', async () => {
    const calls = freshCalls();
    const result = await submitWith(answer('concentrarse en algo'), { calls });
    // Nothing about the book's word: no expected answer, no explanation.
    expect(result).toEqual({
      otherWording: true,
      courseEntry: { text: 'concentrarse en algo', place: unit5 },
    });
    expect(calls).toEqual({ commits: 0, lookups: 1, judged: 1 });
  });

  it('does not reveal the solution through another course entry', async () => {
    const result = await submitWith(answer('cell phone'), {
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
    expect(await submitWith(answer('centrarse en algo'))).toEqual({
      otherWording: true,
      courseEntry: null,
    });
  });

  it('asks the judge once for the same wording typed again', async () => {
    const options = { calls: freshCalls(), cache: memoryCache() };
    const first = await submitWith(answer('concentrarse en algo'), options);
    const again = await submitWith(answer('concentrarse en algo'), options);
    expect(again).toEqual(first);
    expect(options.calls).toEqual({ commits: 0, lookups: 2, judged: 1 });
  });

  it('grades the next try like a first answer', async () => {
    const options = { calls: freshCalls(), cache: memoryCache() };
    await submitWith(answer('concentrarse en algo'), options);
    const result = await submitWith(answer('enfocarse en algo'), options);
    expect(result).toMatchObject({
      graded: true,
      correct: true,
      stored: true,
      rating: ratings.good,
    });
    expect(options.calls).toEqual({ commits: 1, lookups: 1, judged: 1 });
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
