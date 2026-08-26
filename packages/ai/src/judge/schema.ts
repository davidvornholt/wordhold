import { Schema } from 'effect';

const Dimension = Schema.Struct({
  ok: Schema.Boolean,
  note: Schema.optional(Schema.String),
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
export const JudgeVerdict = Schema.Struct({
  correct: Schema.Boolean,
  acceptAsAlternative: Schema.Boolean,
  meaning: Dimension,
  grammar: Dimension,
  idiomaticity: Dimension,
  spelling: Dimension,
  intendedConstruction: Dimension,
  explanation: Schema.String,
});
export type JudgeVerdictData = typeof JudgeVerdict.Type;

export const isAcceptedAlternative = (verdict: JudgeVerdictData): boolean =>
  verdict.acceptAsAlternative && verdict.correct && allDimensionsPass(verdict);

export type JudgeInput = {
  readonly direction: 'to_target' | 'to_native';
  readonly targetLanguage: string;
  readonly prompt: string;
  readonly expectedAnswers: ReadonlyArray<string>;
  readonly givenAnswer: string;
  readonly entryType: 'word' | 'expression' | 'sentence';
};
