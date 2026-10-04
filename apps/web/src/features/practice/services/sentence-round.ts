import type { RailOutcome } from '../../../shared/session/rail-outcome';

// A round of sentences, as in word practice: every sentence is asked once,
// then the missed ones are asked again until each is translated correctly.
// A sentence the judge could not check leaves the round, since asking it
// again would not give a verdict either.
export type SentenceRound = {
  // Entries asked in the first pass, in asking order.
  readonly asked: ReadonlyArray<string>;
  // Missed entries waiting for the after-round. One missed again goes to
  // the back.
  readonly repeat: ReadonlyArray<string>;
  // Entries missed in the first pass.
  readonly missed: ReadonlySet<string>;
  // The latest finished outcome of each asked entry.
  readonly outcomes: ReadonlyMap<string, RailOutcome>;
  // The verdict on the sentence on screen, until "Weiter" finishes it.
  readonly judged: RailOutcome | null;
  // Counts the cards shown, so a sentence asked again gets a fresh card.
  readonly turn: number;
};

export const emptySentenceRound: SentenceRound = {
  asked: [],
  repeat: [],
  missed: new Set(),
  outcomes: new Map(),
  judged: null,
  turn: 0,
};

export type NextSentence = {
  readonly entryId: string;
  readonly repeated: boolean;
};

// `entryIds` is the round's sentences in asking order. It can still shrink
// while examples are prepared, so it is passed in rather than stored.
export const nextSentence = (
  round: SentenceRound,
  entryIds: ReadonlyArray<string>,
): NextSentence | null => {
  const fresh = entryIds.find((entryId) => !round.asked.includes(entryId));
  if (fresh !== undefined) {
    return { entryId: fresh, repeated: false };
  }
  const [again] = round.repeat;
  return again === undefined ? null : { entryId: again, repeated: true };
};

export const judgeSentence = (
  round: SentenceRound,
  outcome: RailOutcome,
): SentenceRound => ({ ...round, judged: outcome });

// Moves past the sentence on screen with its verdict. Without a verdict
// there is nothing to finish.
export const finishSentence = (
  round: SentenceRound,
  entryId: string,
): SentenceRound => {
  const outcome = round.judged;
  if (outcome === null) {
    return round;
  }
  const firstPass = !round.asked.includes(entryId);
  const repeat = round.repeat.filter((id) => id !== entryId);
  return {
    asked: firstPass ? [...round.asked, entryId] : round.asked,
    repeat: outcome === 'wrong' ? [...repeat, entryId] : repeat,
    missed:
      firstPass && outcome === 'wrong'
        ? new Set(round.missed).add(entryId)
        : round.missed,
    outcomes: new Map(round.outcomes).set(entryId, outcome),
    judged: null,
    turn: round.turn + 1,
  };
};

// The learner overrules the judge: the sentence counts as correct.
export const acceptSentence = (
  round: SentenceRound,
  entryId: string,
): SentenceRound => finishSentence(judgeSentence(round, 'correct'), entryId);

export type SentenceRoundCounts = {
  readonly firstTryCorrect: number;
  readonly afterRoundCorrect: number;
  readonly ungraded: number;
  // The first pass's outcome of each asked sentence, in asking order.
  readonly firstPass: ReadonlyArray<RailOutcome>;
};

export const sentenceRoundCounts = (
  round: SentenceRound,
): SentenceRoundCounts => {
  const count = (keep: (entryId: string) => boolean) =>
    round.asked.filter(keep).length;
  const finalOutcome = (entryId: string) => round.outcomes.get(entryId);
  return {
    firstTryCorrect: count(
      (id) => !round.missed.has(id) && finalOutcome(id) === 'correct',
    ),
    afterRoundCorrect: count(
      (id) => round.missed.has(id) && finalOutcome(id) === 'correct',
    ),
    ungraded: count((id) => finalOutcome(id) === 'ungraded'),
    firstPass: round.asked.map((id) => {
      if (round.missed.has(id)) {
        return 'wrong';
      }
      return finalOutcome(id) === 'ungraded' ? 'ungraded' : 'correct';
    }),
  };
};
