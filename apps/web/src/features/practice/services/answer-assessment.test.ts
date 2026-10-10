import { describe, expect, it } from 'bun:test';
import type { DefinitionVerdictData } from '@wordhold/ai/definition/schema';
import { Effect } from 'effect';
import type {
  CachedVerdict,
  StoredVerdict,
  SubmissionRecord,
} from '../schemas/practice-models';
import { loadRejectedAssessment } from './answer-assessment';
import { definitionCacheIdentity } from './judge-cache';
import type { JudgeCacheStore } from './judge-cache-store';
import { testCard, testGrader } from './practice-service-test-support';

const assessmentId = '00000000-0000-0000-0000-000000000003';
const keyPoints = ['ist ein Stoff', 'senkt die Aktivierungsenergie'];
const answer = 'Ein Stoff.';
const grader = testGrader({});

const termRow = (
  stored: ReadonlyArray<string> | null = keyPoints,
): SubmissionRecord => ({
  card: { ...testCard, direction: 'to_native' },
  entry: {
    id: testCard.entryId,
    targetText: 'Katalysator',
    nativeText: 'Ein Stoff, der die Aktivierungsenergie senkt.',
    relatedWords: [],
    keyPoints: stored,
  },
  targetLanguage: 'de',
  courseKind: 'terms',
});

const missedVerdict: DefinitionVerdictData = {
  keyPoints: [
    { covered: true, note: null },
    { covered: false, note: 'Die Aktivierungsenergie fehlt.' },
  ],
  accuracy: { ok: true, note: null },
  explanation: 'Die Aktivierungsenergie fehlt.',
};

const cacheWith = (
  verdict: StoredVerdict,
  model: string,
): JudgeCacheStore['Service'] => {
  const cached: CachedVerdict = { assessmentId, verdict, model };
  return {
    read: () => Effect.succeed(cached),
    write: () => Effect.void,
    withCriticalSection: (_key, effect) => effect,
  };
};

// The verdict is cached as judged against `judgedKeyPoints`, which the row's
// current key points may no longer match.
const load = async (
  row: SubmissionRecord,
  verdict: StoredVerdict,
  judgedKeyPoints: ReadonlyArray<string> = keyPoints,
) => {
  const model = await definitionCacheIdentity(grader.model, {
    term: row.entry.targetText,
    definition: row.entry.nativeText,
    keyPoints: judgedKeyPoints,
    givenAnswer: answer,
  });
  return Effect.runPromise(
    loadRejectedAssessment({
      row,
      answer,
      normalized: 'ein stoff',
      assessmentId,
      cache: cacheWith(verdict, model),
      grader,
    }).pipe(Effect.result),
  );
};

describe('loadRejectedAssessment for definitions', () => {
  it('returns the rejected definition with the key points it was graded against', async () => {
    expect(await load(termRow(), missedVerdict)).toMatchObject({
      _tag: 'Success',
      success: {
        assessmentId,
        outcome: { method: 'definition', keyPoints, verdict: missedVerdict },
      },
    });
  });

  it('refuses a verdict that no longer lines up with the key points', async () => {
    const edited = termRow([...keyPoints, 'wird nicht verbraucht']);
    expect(await load(edited, missedVerdict)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'StaleAnswerSubmissionError' },
    });
  });

  it('refuses a verdict judged against other key points of the same number', async () => {
    const edited = termRow(['ist ein Stoff', 'beschleunigt Reaktionen']);
    expect(await load(edited, missedVerdict)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'StaleAnswerSubmissionError' },
    });
  });

  it('refuses a translation verdict for a term', async () => {
    const translation = {
      correct: false,
      acceptAsAlternative: false,
      meaning: { ok: false, note: null },
      grammar: { ok: true, note: null },
      idiomaticity: { ok: true, note: null },
      spelling: { ok: true, note: null },
      intendedConstruction: { ok: true, note: null },
      explanation: 'Falsch.',
    };
    expect(await load(termRow(), translation)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'StaleAnswerSubmissionError' },
    });
  });

  it('refuses a definition that was judged correct', async () => {
    const covered: DefinitionVerdictData = {
      ...missedVerdict,
      keyPoints: [
        { covered: true, note: null },
        { covered: true, note: null },
      ],
    };
    expect(await load(termRow(), covered)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'StaleAnswerSubmissionError' },
    });
  });
});
