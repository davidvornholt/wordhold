import { describe, expect, it } from 'bun:test';
import {
  decodeSubmitPayload,
  maximumElapsedMs,
  maximumSubmittedAnswerLength,
} from './submission-schema';

const ordinaryElapsedMs = 1200;
const fractionalElapsedMs = 1.5;

const validPayload = {
  cardId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  revision: 0,
  answer: 'souvenir',
  elapsedMs: ordinaryElapsedMs,
  wrongAnswerResolution: 'defer',
  mode: 'scheduled',
} as const;

describe('decodeSubmitPayload', () => {
  it('accepts finite non-negative integer elapsed time within one day', () => {
    expect(decodeSubmitPayload(validPayload).elapsedMs).toBe(ordinaryElapsedMs);
    expect(
      decodeSubmitPayload({ ...validPayload, elapsedMs: maximumElapsedMs })
        .elapsedMs,
    ).toBe(maximumElapsedMs);
  });

  it.each([
    -1,
    fractionalElapsedMs,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    maximumElapsedMs + 1,
  ])('rejects invalid elapsed time %p', (elapsedMs) => {
    expect(() => decodeSubmitPayload({ ...validPayload, elapsedMs })).toThrow();
  });

  // Mode is stored review provenance, so invalid labels must not reach the
  // database enum or silently fall through to its default.
  it('rejects a payload without a recognised mode', () => {
    expect(() =>
      decodeSubmitPayload({ ...validPayload, mode: 'cram' }),
    ).toThrow();
    const { mode: _mode, ...withoutMode } = validPayload;
    expect(() => decodeSubmitPayload(withoutMode)).toThrow();
  });

  it('rejects an answer over the parser input limit', () => {
    expect(() =>
      decodeSubmitPayload({
        ...validPayload,
        answer: 'a'.repeat(maximumSubmittedAnswerLength + 1),
      }),
    ).toThrow();
  });

  it('rejects an unknown wrong-answer resolution', () => {
    expect(() =>
      decodeSubmitPayload({
        ...validPayload,
        wrongAnswerResolution: 'easy',
      }),
    ).toThrow();
  });

  it('requires the rejected assessment when resolving a wrong answer', () => {
    expect(() =>
      decodeSubmitPayload({
        ...validPayload,
        wrongAnswerResolution: 'hard',
      }),
    ).toThrow();
    expect(
      decodeSubmitPayload({
        ...validPayload,
        wrongAnswerResolution: 'hard',
        assessmentId: '42db2e83-fcc5-49f1-80cf-44efac70ec00',
      }),
    ).toMatchObject({ wrongAnswerResolution: 'hard' });
  });
});
