import { describe, expect, it } from 'bun:test';
import type {
  DefinitionJudgeInput,
  DefinitionVerdictData,
} from '@wordhold/ai/definition/schema';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import type {
  PersistReviewInput,
  SubmissionRecord,
} from '../schemas/practice-models';
import {
  persistedReview,
  runSubmitPayload,
  testCard,
  testGrader,
  testJudge,
  unavailableJudge,
} from './practice-service-test-support';
import type { PracticeReviewStore } from './review-store';

const definition =
  'Ein Katalysator ist ein Stoff, der die Aktivierungsenergie senkt und nicht verbraucht wird.';
const keyPoints = [
  'ist ein Stoff',
  'senkt die Aktivierungsenergie',
  'wird nicht verbraucht',
];

const termSubmission = (
  stored: ReadonlyArray<string> | null,
): SubmissionRecord => ({
  card: { ...testCard, direction: 'to_native' },
  entry: {
    id: testCard.entryId,
    targetText: 'Katalysator',
    nativeText: definition,
    keyPoints: stored,
  },
  targetLanguage: 'de',
  courseKind: 'terms',
});

const verdict = (covered: ReadonlyArray<boolean>): DefinitionVerdictData => ({
  keyPoints: covered.map((ok, index) => ({
    covered: ok,
    note: ok ? null : `Punkt ${index + 1} fehlt.`,
  })),
  accuracy: { ok: true, note: null },
  explanation: covered.every(Boolean)
    ? 'Alles drin.'
    : 'Die Aktivierungsenergie fehlt.',
});

type Recorded = {
  readonly saved: Array<ReadonlyArray<string>>;
  readonly commits: Array<PersistReviewInput>;
  readonly judged: Array<DefinitionJudgeInput>;
};

type SubmitOptions = {
  readonly elapsedMs?: number;
  // Key points another answer stored first, which a late save leaves alone.
  readonly storedFirst?: ReadonlyArray<string>;
};

const reviewStore = (
  submission: SubmissionRecord,
  recorded: Recorded,
  { storedFirst }: SubmitOptions,
): PracticeReviewStore['Type'] => ({
  findSubmission: () => Effect.succeed(submission),
  saveKeyPoints: (_entryId, _definition, points) =>
    Effect.sync(() => {
      recorded.saved.push(points);
      return storedFirst ?? points;
    }),
  listAcceptedAnswers: () =>
    Effect.succeed([{ text: definition, source: 'manual' }]),
  commit: (input) =>
    Effect.sync(() => {
      recorded.commits.push(input);
      return persistedReview;
    }),
});

const submitDefinition = (
  stored: ReadonlyArray<string> | null,
  covered: ReadonlyArray<boolean>,
  answer: string,
  options: SubmitOptions = {},
) => {
  const recorded: Recorded = { saved: [], commits: [], judged: [] };
  const result = runSubmitPayload(
    reviewStore(termSubmission(stored), recorded, options),
    testJudge(() => unavailableJudge('translation judge must not run')),
    {
      cardId: testCard.id,
      revision: testCard.revision,
      answer,
      dictated: false,
      elapsedMs: options.elapsedMs,
      wrongAnswerResolution: 'defer',
      mode: 'scheduled',
    },
    testGrader({
      keyPoints: () => Effect.succeed(keyPoints),
      judge: (input) =>
        Effect.sync(() => {
          recorded.judged.push(input);
          return verdict(covered);
        }),
    }),
  );
  return { result, recorded };
};

describe('PracticeService definitions', () => {
  it('derives missing key points and reports each one a wrong answer missed', async () => {
    const { result, recorded } = submitDefinition(
      null,
      [true, false, true],
      'Ein Stoff, der Reaktionen beschleunigt und nicht verbraucht wird.',
    );
    expect(await result).toMatchObject({
      _tag: 'Right',
      right: {
        graded: true,
        correct: false,
        stored: false,
        explanation: 'Die Aktivierungsenergie fehlt.',
        keyPoints: [
          { text: 'ist ein Stoff', covered: true, note: null },
          {
            text: 'senkt die Aktivierungsenergie',
            covered: false,
            note: 'Punkt 2 fehlt.',
          },
          { text: 'wird nicht verbraucht', covered: true, note: null },
        ],
      },
    });
    expect(recorded.saved).toEqual([keyPoints]);
    expect(recorded.judged.at(0)?.keyPoints).toEqual(keyPoints);
    expect(recorded.commits).toHaveLength(0);
  });

  it('grades against the key points another answer stored first', async () => {
    const storedFirst = ['ist ein Stoff', 'beschleunigt Reaktionen', 'bleibt'];
    const { result, recorded } = submitDefinition(
      null,
      [true, false, true],
      'Ein Stoff, der Reaktionen beschleunigt.',
      { storedFirst },
    );
    expect(await result).toMatchObject({
      _tag: 'Right',
      right: {
        keyPoints: [
          { text: 'ist ein Stoff' },
          { text: 'beschleunigt Reaktionen' },
          { text: 'bleibt' },
        ],
      },
    });
    expect(recorded.judged.at(0)?.keyPoints).toEqual(storedFirst);
  });

  it('commits a definition that covers every key point as good', async () => {
    const { result, recorded } = submitDefinition(
      keyPoints,
      [true, true, true],
      'Ein Stoff, der die Aktivierungsenergie senkt und dabei nicht verbraucht wird.',
    );
    expect(await result).toMatchObject({
      _tag: 'Right',
      right: { graded: true, correct: true, stored: true },
    });
    expect(recorded.saved).toHaveLength(0);
    expect(recorded.commits.at(0)).toMatchObject({
      rating: ratings.good,
      outcome: { method: 'definition', keyPoints },
    });
  });

  it('accepts the stored definition without asking the judge, however fast', async () => {
    const { result, recorded } = submitDefinition(null, [], definition, {
      elapsedMs: 3000,
    });
    expect(await result).toMatchObject({
      _tag: 'Right',
      right: { graded: true, correct: true, keyPoints: null },
    });
    expect(recorded.saved).toHaveLength(0);
    expect(recorded.judged).toHaveLength(0);
    expect(recorded.commits.at(0)).toMatchObject({
      rating: ratings.good,
      elapsedMs: 3000,
    });
  });
});
