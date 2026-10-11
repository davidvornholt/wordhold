import { describe, expect, it } from 'bun:test';
import { Effect, Layer, Schema } from 'effect';
import { generateStructured } from './structured-generation';
import { capturedBedrockModel } from './testing/bedrock';
import { AiUsage } from './usage';

const Verdict = Schema.Struct({ correct: Schema.Boolean });

const generate = (
  answers: ReadonlyArray<unknown>,
  validate?: (answer: typeof Verdict.Type) => string | undefined,
) => {
  const { calls, model } = capturedBedrockModel(...answers);
  const settled: Array<boolean> = [];
  const usage = Layer.succeed(
    AiUsage,
    AiUsage.of({
      start: () =>
        Effect.succeed({
          settle: (outcome) =>
            Effect.sync(() => {
              settled.push(outcome.succeeded);
            }),
        }),
    }),
  );
  const result = Effect.runPromise(
    generateStructured({
      model,
      operation: 'answer-grading',
      schema: Verdict,
      prompt: 'Grade the answer.',
      failure: (cause) => ({ cause }),
      validate,
    }).pipe(Effect.provide(usage), Effect.result),
  );
  return { calls, result, settled };
};

// Bedrock receives the schema only as an instruction, so the answer text can
// miss it. Every request is metered, including the repeated one.
describe('generateStructured', () => {
  it.each([
    {
      name: 'text that is not JSON',
      unusable: 'Gern, hier ist die Bewertung:',
      firstSucceeded: false,
    },
    {
      name: 'JSON outside the schema',
      unusable: { correct: 'yes' },
      firstSucceeded: true,
    },
  ])('asks once more after $name', async ({ unusable, firstSucceeded }) => {
    const { calls, result, settled } = generate([unusable, { correct: true }]);
    expect(await result).toMatchObject({
      _tag: 'Success',
      success: { correct: true },
    });
    expect(calls).toHaveLength(2);
    expect(settled).toEqual([firstSucceeded, true]);
  });

  it('asks once more after an answer the caller rejects', async () => {
    const { calls, result } = generate(
      [{ correct: false }, { correct: true }],
      (answer) => (answer.correct ? undefined : 'Expected a passing verdict.'),
    );
    expect(await result).toMatchObject({
      _tag: 'Success',
      success: { correct: true },
    });
    expect(calls).toHaveLength(2);
  });

  // A repeated request would be billed again without a better chance.
  it('does not repeat a request the provider rejects', async () => {
    const { calls, result, settled } = generate([
      Response.json({ message: 'Malformed input request' }, { status: 400 }),
    ]);
    expect(await result).toMatchObject({
      _tag: 'Failure',
      failure: { cause: { statusCode: 400 } },
    });
    expect(calls).toHaveLength(1);
    expect(settled).toEqual([false]);
  });

  it('fails with the second unusable answer', async () => {
    const { calls, result } = generate(['{"correct": true,']);
    expect(await result).toMatchObject({
      _tag: 'Failure',
      failure: {
        cause: {
          _tag: 'UnusableAnswerError',
          message: 'The answer is not a JSON object.',
        },
      },
    });
    expect(calls).toHaveLength(2);
  });
});
