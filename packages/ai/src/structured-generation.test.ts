import { describe, expect, it } from 'bun:test';
import { APICallError, RetryError } from 'ai';
import { Effect, Layer, Schema } from 'effect';
import { describeFailure, generateStructured } from './structured-generation';
import {
  anthropicError,
  anthropicMessage,
  capturedAnthropicModel,
  connectionReset,
} from './testing/anthropic';
import { AiUsage } from './usage';

const Verdict = Schema.Struct({ correct: Schema.Boolean });

const generate = (
  answers: ReadonlyArray<unknown>,
  validate?: (answer: typeof Verdict.Type) => string | undefined,
) => {
  const { calls, model } = capturedAnthropicModel(...answers);
  const settled: Array<boolean> = [];
  const reported: Array<unknown> = [];
  const usage = Layer.succeed(
    AiUsage,
    AiUsage.of({
      start: () =>
        Effect.succeed({
          settle: (outcome) =>
            Effect.sync(() => {
              settled.push(outcome.succeeded);
              reported.push(outcome.usage?.tokens);
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
  return { calls, reported, result, settled };
};

// An unusable answer is requested once more. Every request is metered,
// including the repeated one.
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
  it.each([
    { status: 400, type: 'invalid_request_error' },
    { status: 401, type: 'authentication_error' },
    { status: 403, type: 'permission_error' },
  ])('does not repeat a request rejected with $status', async (error) => {
    const { calls, result, settled } = generate([
      anthropicError(error.status, error.type),
    ]);
    expect(await result).toMatchObject({
      _tag: 'Failure',
      failure: { cause: { statusCode: error.status } },
    });
    expect(calls).toHaveLength(1);
    expect(settled).toEqual([false]);
  });

  // The AI SDK retries twice within the one metered request.
  it.each([
    { status: 429, type: 'rate_limit_error' },
    { status: 500, type: 'api_error' },
    { status: 529, type: 'overloaded_error' },
  ])('retries a request that failed with $status', async (error) => {
    const { calls, result, settled } = generate([
      anthropicError(error.status, error.type),
      { correct: true },
    ]);
    expect(await result).toMatchObject({
      _tag: 'Success',
      success: { correct: true },
    });
    expect(calls).toHaveLength(2);
    expect(settled).toEqual([true]);
  });

  it('retries a request whose connection dropped', async () => {
    const { calls, result } = generate([connectionReset(), { correct: true }]);
    expect(await result).toMatchObject({ _tag: 'Success' });
    expect(calls).toHaveLength(2);
  });

  it('gives up after two retries', async () => {
    const { calls, result, settled } = generate([
      anthropicError(529, 'overloaded_error'),
    ]);
    const outcome = await result;
    expect(outcome).toMatchObject({ _tag: 'Failure' });
    expect(calls).toHaveLength(3);
    expect(settled).toEqual([false]);
  });

  // A refusal or an answer cut off at the output limit would end the same way
  // again, so neither is requested once more. Both were billed.
  it.each([
    {
      name: 'a refusal',
      answer: anthropicMessage('', 'refusal'),
      finishReason: 'content-filter',
    },
    {
      name: 'a refusal after part of the answer',
      answer: anthropicMessage('{"correct": tr', 'refusal'),
      finishReason: 'content-filter',
    },
    {
      name: 'an answer cut off at the output limit',
      answer: anthropicMessage('{"correct": tr', 'max_tokens'),
      finishReason: 'length',
    },
  ])('fails without repeating $name', async ({ answer, finishReason }) => {
    const { calls, reported, result, settled } = generate([answer]);
    expect(await result).toMatchObject({
      _tag: 'Failure',
      failure: { cause: { _tag: 'IncompleteAnswerError', finishReason } },
    });
    expect(calls).toHaveLength(1);
    expect(settled).toEqual([false]);
    expect(reported).toEqual([
      { input: 10, cachedInput: 0, cacheWrite: 0, output: 20 },
    ]);
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

const apiError = (statusCode: number | undefined, isRetryable: boolean) =>
  new APICallError({
    message: 'Test error',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode,
    isRetryable,
  });

describe('describeFailure', () => {
  it('names a rejected key as a configuration problem', () => {
    expect(describeFailure(apiError(401, false))).toBe(
      'The Claude API rejected the key or its permissions (HTTP 401); check ANTHROPIC_API_KEY.',
    );
    expect(describeFailure(apiError(403, false))).toContain('HTTP 403');
  });

  it('names a failure that outlasted the retries', () => {
    const exhausted = new RetryError({
      message: 'Failed after 3 attempts.',
      reason: 'maxRetriesExceeded',
      errors: [apiError(529, true), apiError(529, true), apiError(529, true)],
    });
    expect(describeFailure(exhausted)).toBe(
      'The Claude API still failed after 2 retries (HTTP 529).',
    );
    expect(describeFailure(apiError(undefined, true))).toBe(
      'The Claude API still failed after 2 retries (no response).',
    );
  });

  it('names any other rejection by its status alone', () => {
    expect(describeFailure(apiError(400, false))).toBe(
      'The Claude API rejected the request (HTTP 400).',
    );
    expect(describeFailure(new DOMException('Late', 'TimeoutError'))).toBe(
      'The request failed with TimeoutError.',
    );
  });
});
