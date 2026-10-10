import { Schema } from 'effect';

const Dimension = Schema.Struct({
  ok: Schema.Boolean,
  note: Schema.NullOr(Schema.String),
});

type DimensionData = typeof Dimension.Type;

const allDimensionsPass = (verdict: {
  readonly meaning: DimensionData;
  readonly grammar: DimensionData;
  readonly idiomaticity: DimensionData;
  readonly spelling: DimensionData;
  readonly intendedConstruction: DimensionData;
}): boolean =>
  verdict.meaning.ok &&
  verdict.grammar.ok &&
  verdict.idiomaticity.ok &&
  verdict.spelling.ok &&
  verdict.intendedConstruction.ok;

// Multi-dimensional verdict: an answer is judged on what it got right and
// wrong, not just pass/fail. `correct` drives FSRS rating derivation;
// `acceptAsAlternative` proposes the accepted-answer write-back so the same
// answer never reaches the judge again.
//
// Nothing here constrains one field by another. Structured output guarantees
// the shape, not the reasoning, and a model that calls an answer a good
// alternative while faulting one dimension has still written a verdict worth
// showing. Rejecting it at decoding would discard the explanation too and
// leave the learner looking at "judge unreachable" over a disagreement about
// a boolean. `isAcceptedAlternative` is the gate that matters, because it
// guards the only irreversible step: writing the answer back as accepted.
//
// `explanation` is null when there is nothing to add to the verdict, so the
// feedback does not repeat "Richtig" under its own heading.
export const JudgeVerdict = Schema.Struct({
  correct: Schema.Boolean,
  acceptAsAlternative: Schema.Boolean,
  meaning: Dimension,
  grammar: Dimension,
  idiomaticity: Dimension,
  spelling: Dimension,
  intendedConstruction: Dimension,
  explanation: Schema.NullOr(Schema.String),
});
export type JudgeVerdictData = typeof JudgeVerdict.Type;

export const isAcceptedAlternative = (verdict: JudgeVerdictData): boolean =>
  verdict.acceptAsAlternative && verdict.correct && allDimensionsPass(verdict);

type JudgeAnswer = {
  readonly targetLanguage: string;
  // The word or text the card shows.
  readonly prompt: string;
  readonly expectedAnswers: ReadonlyArray<string>;
  readonly givenAnswer: string;
};

// A translation between German and the target language, or a synonym or
// antonym of a target-language word in that same language. A word can have
// several senses, so a synonym or antonym is judged in the sense its German
// meaning names.
export type JudgeInput =
  | (JudgeAnswer & { readonly direction: 'to_target' | 'to_native' })
  | (JudgeAnswer & {
      readonly direction: 'to_synonym' | 'to_antonym';
      readonly meaning: string;
    });
