import { describe, expect, it } from 'bun:test';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import {
  acceptSentence,
  emptySentenceRound,
  finishSentence,
  judgeSentence,
  nextSentence,
  type SentenceRound,
  sentenceRoundCounts,
} from './sentence-round';

const entryIds = ['a', 'b', 'c'];

const answer = (round: SentenceRound, outcome: RailOutcome): SentenceRound => {
  const next = nextSentence(round, entryIds);
  if (next === null) {
    throw new Error('The round has already ended.');
  }
  return finishSentence(judgeSentence(round, outcome), next.entryId);
};

const answerAll = (outcomes: ReadonlyArray<RailOutcome>) =>
  outcomes.reduce(answer, emptySentenceRound);

describe('sentence round', () => {
  it('asks every sentence once and ends without mistakes', () => {
    const round = answerAll(['correct', 'correct', 'correct']);

    expect(nextSentence(round, entryIds)).toBeNull();
    expect(sentenceRoundCounts(round)).toEqual({
      firstTryCorrect: 3,
      afterRoundCorrect: 0,
      ungraded: 0,
      firstPass: ['correct', 'correct', 'correct'],
    });
  });

  it('asks missed sentences again after the first pass until they are right', () => {
    const firstPass = answerAll(['wrong', 'correct', 'wrong']);
    expect(nextSentence(firstPass, entryIds)).toEqual({
      entryId: 'a',
      repeated: true,
    });

    const missedAgain = answer(firstPass, 'wrong');
    // A sentence missed again goes to the back.
    expect(missedAgain.repeat).toEqual(['c', 'a']);

    const done = answer(answer(missedAgain, 'correct'), 'correct');
    expect(nextSentence(done, entryIds)).toBeNull();
    expect(sentenceRoundCounts(done)).toEqual({
      firstTryCorrect: 1,
      afterRoundCorrect: 2,
      ungraded: 0,
      firstPass: ['wrong', 'correct', 'wrong'],
    });
  });

  it('does not ask again a sentence the judge could not check', () => {
    const round = answerAll(['ungraded', 'wrong', 'correct']);
    const unchecked = answer(round, 'ungraded');

    expect(nextSentence(unchecked, entryIds)).toBeNull();
    expect(sentenceRoundCounts(unchecked)).toEqual({
      firstTryCorrect: 1,
      afterRoundCorrect: 0,
      ungraded: 2,
      firstPass: ['ungraded', 'wrong', 'correct'],
    });
  });

  it('counts an overruled sentence as correct without asking it again', () => {
    const overruled = acceptSentence(
      judgeSentence(emptySentenceRound, 'wrong'),
      'a',
    );
    expect(overruled.repeat).toEqual([]);

    const missed = answer(answer(overruled, 'wrong'), 'correct');
    const overruledLater = acceptSentence(judgeSentence(missed, 'wrong'), 'b');
    expect(nextSentence(overruledLater, entryIds)).toBeNull();
    expect(sentenceRoundCounts(overruledLater)).toMatchObject({
      firstTryCorrect: 2,
      afterRoundCorrect: 1,
    });
  });

  it('keeps a sentence on screen until it has a verdict', () => {
    expect(finishSentence(emptySentenceRound, 'a')).toBe(emptySentenceRound);
  });

  it('gives a sentence asked again a fresh card', () => {
    const firstPass = answerAll(['wrong', 'correct', 'correct']);
    const missedAgain = answer(firstPass, 'wrong');
    expect(nextSentence(missedAgain, entryIds)).toEqual(
      nextSentence(firstPass, entryIds),
    );
    expect(missedAgain.turn).toBeGreaterThan(firstPass.turn);
  });
});
