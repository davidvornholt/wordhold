import { describe, expect, it } from 'bun:test';
import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import type {
  PersistReviewInput,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import {
  persistedReview,
  runSubmitPayload,
  testCard,
  testGrader,
  testJudge,
  testSubmission,
  unavailableJudge,
} from './practice-service-test-support';
import type { PracticeReviewStore } from './review-store';

// From the Luther Bible of 1912, which is in the public domain.
const verse =
  'Also hat Gott die Welt geliebt, daß er seinen eingeborenen Sohn gab.';

const textSubmission: SubmissionRecord = {
  card: { ...testCard, direction: 'to_native' },
  entry: {
    id: testCard.entryId,
    targetText: 'Johannes 3,16',
    nativeText: verse,
    keyPoints: null,
  },
  targetLanguage: 'de',
  courseKind: 'texts',
};

const reviewStore = (
  submission: SubmissionRecord,
  commits: Array<PersistReviewInput>,
): PracticeReviewStore['Service'] => ({
  findSubmission: () => Effect.succeed(submission),
  saveKeyPoints: () => Effect.die('key points must not be saved'),
  listAcceptedAnswers: () =>
    Effect.succeed([{ text: verse, source: 'manual' }]),
  commit: (input) =>
    Effect.sync(() => {
      commits.push(input);
      return persistedReview;
    }),
});

const payload = (answer: string, dictated: boolean): SubmitPayloadData => ({
  cardId: testCard.id,
  revision: testCard.revision,
  answer,
  dictated,
  elapsedMs: 2000,
  wrongAnswerResolution: 'defer',
  mode: 'scheduled',
});

const submit = (
  answer: string,
  { submission = textSubmission, dictated = false } = {},
) => {
  const commits: Array<PersistReviewInput> = [];
  const result = runSubmitPayload(
    reviewStore(submission, commits),
    testJudge(() => unavailableJudge('the judge must not run')),
    payload(answer, dictated),
    testGrader(),
  );
  return { result, commits };
};

describe('PracticeService recited texts', () => {
  it('commits a word-perfect text as Good without asking the judge', async () => {
    const { result, commits } = submit(verse.toLowerCase());
    expect(await result).toMatchObject({
      _tag: 'Success',
      success: { correct: true, stored: true, rating: ratings.good },
    });
    expect(commits.map((commit) => [commit.rating, commit.outcome])).toEqual([
      [
        ratings.good,
        {
          method: 'recitation',
          dictated: false,
          words: 12,
          mistakes: 0,
          typos: 0,
          soundAlikes: 0,
        },
      ],
    ]);
  });

  it('forgives a dictated word that sounds right but not a typed one', async () => {
    const spoken = verse.replace('daß', 'das');
    const dictated = submit(spoken, { dictated: true });
    expect(await dictated.result).toMatchObject({
      _tag: 'Success',
      success: { correct: true, rating: ratings.good },
    });
    expect(dictated.commits[0]?.outcome).toMatchObject({
      dictated: true,
      mistakes: 0,
      soundAlikes: 1,
    });

    const typed = submit(spoken);
    expect(await typed.result).toMatchObject({
      _tag: 'Success',
      success: { correct: true, rating: ratings.hard },
    });
  });

  it('commits a wrong recitation at once, with nothing left to overrule', async () => {
    const { result, commits } = submit('Denn so hat Gott die Welt geliebt');
    expect(await result).toMatchObject({
      _tag: 'Success',
      success: {
        correct: false,
        stored: true,
        rating: ratings.again,
        expectedAnswer: verse,
        explanation: null,
        keyPoints: null,
      },
    });
    expect(commits).toHaveLength(1);
  });

  it('accepts a recited text longer than an entry, but not a long translation', async () => {
    const long = `${verse} `.repeat(10);
    expect(long.length).toBeGreaterThan(maximumEntryTextLength);
    const { result } = submit(long);
    expect(await result).toMatchObject({
      _tag: 'Success',
      success: { correct: false, stored: true },
    });

    const { result: translation, commits } = submit(long, {
      submission: testSubmission,
    });
    expect(await translation).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'AnswerTooLongError' },
    });
    expect(commits).toHaveLength(0);
  });
});
