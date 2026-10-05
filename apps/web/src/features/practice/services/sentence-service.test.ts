import { describe, expect, it } from 'bun:test';
import type {
  SentenceJudgeInput,
  SentenceVerdictData,
} from '@wordhold/ai/sentence/judge-schema';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Effect, Layer, Result } from 'effect';
import { PracticeJudgeError } from '../errors/practice-errors';
import type { SentenceAnswerData } from '../schemas/sentence-models';
import { SentenceGrader } from './sentence-grader';
import { SentenceService } from './sentence-service';
import { SentenceStore, type SentenceTarget } from './sentence-store';

const entryId = '11111111-1111-4111-8111-111111111111';

const target: SentenceTarget = {
  targetLanguage: 'es',
  word: { target: 'la hermana', german: 'die Schwester' },
  sentence: 'Meine Schwester ist Anwältin.',
  reference: 'Mi hermana es abogada.',
};

const answer = (given: string): SentenceAnswerData => ({
  entryId,
  sentence: target.sentence,
  answer: given,
});

const verdict = (
  overrides: Partial<SentenceVerdictData>,
): SentenceVerdictData => ({
  meaningKept: true,
  grammatical: true,
  spelledCorrectly: true,
  wordUsed: true,
  correction: null,
  explanation: 'Richtig.',
  ...overrides,
});

const runCheck = (
  data: SentenceAnswerData,
  judge: (
    input: SentenceJudgeInput,
  ) => Effect.Effect<SentenceVerdictData, PracticeJudgeError>,
) =>
  Effect.runPromise(
    Effect.flatMap(SentenceService, (service) => service.check(data)).pipe(
      Effect.result,
      Effect.provide(
        SentenceService.layer.pipe(
          Layer.provide(
            Layer.merge(
              Layer.succeed(SentenceStore, {
                loadSession: () => Effect.succeed([]),
                readTarget: () => Effect.succeed(target),
              }),
              Layer.succeed(SentenceGrader, { judge }),
            ),
          ),
        ),
      ),
      Effect.provide(untrackedAiUsage),
    ),
  );

const judgeMustNotRun = () =>
  Effect.die(new Error('the judge must not be asked'));

describe('SentenceService check', () => {
  it('accepts the stored translation without asking the judge', async () => {
    const result = await runCheck(
      answer('  mi hermana es abogada '),
      judgeMustNotRun,
    );
    expect(result).toEqual(
      Result.succeed({
        graded: true,
        correct: true,
        reference: target.reference,
        correction: null,
        explanation: null,
      }),
    );
  });

  it('refuses an answer to a sentence that has changed since it was shown', async () => {
    const result = await runCheck(
      { ...answer('Mi hermana es abogada.'), sentence: 'Ein anderer Satz.' },
      judgeMustNotRun,
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'StaleSentenceError' },
    });
  });

  it('asks the judge with the practised word and shows its correction', async () => {
    const asked: Array<SentenceJudgeInput> = [];
    const result = await runCheck(answer('Mi hermano es abogada.'), (input) =>
      Effect.sync(() => {
        asked.push(input);
        return verdict({
          meaningKept: false,
          correction: 'Mi hermana es abogada.',
          explanation: "'hermano' heißt 'Bruder'.",
        });
      }),
    );
    expect(asked).toEqual([
      {
        targetLanguage: 'Spanish',
        sentence: target.sentence,
        reference: target.reference,
        word: target.word,
        givenAnswer: 'Mi hermano es abogada.',
      },
    ]);
    expect(result).toEqual(
      Result.succeed({
        graded: true,
        correct: false,
        reference: target.reference,
        correction: 'Mi hermana es abogada.',
        explanation: "'hermano' heißt 'Bruder'.",
      }),
    );
  });

  it('keeps a correct paraphrase free of corrections', async () => {
    const result = await runCheck(
      answer('Mi hermana trabaja de abogada.'),
      () =>
        Effect.succeed(
          verdict({ correction: 'Mi hermana trabaja de abogada.' }),
        ),
    );
    expect(result).toEqual(
      Result.succeed({
        graded: true,
        correct: true,
        reference: target.reference,
        correction: null,
        explanation: null,
      }),
    );
  });

  it('leaves the answer ungraded when the judge is unavailable', async () => {
    const result = await runCheck(answer('Mi hermana es juez.'), () =>
      Effect.fail(
        new PracticeJudgeError({
          cause: new Error('timeout'),
          message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
        }),
      ),
    );
    expect(result).toMatchObject({
      _tag: 'Success',
      success: { graded: false, reference: target.reference },
    });
  });
});
