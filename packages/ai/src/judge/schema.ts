import { Schema } from 'effect';

const Dimension = Schema.Struct({
  ok: Schema.Boolean,
  note: Schema.optional(Schema.String),
});

// Multi-dimensional verdict: an answer is judged on what it got right and
// wrong, not just pass/fail. `correct` drives FSRS rating derivation;
// `acceptAsAlternative` triggers the accepted-answer write-back so the same
// answer never reaches the judge again.
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

export type JudgeInput = {
  readonly direction: 'to_target' | 'to_native';
  readonly targetLanguage: string;
  readonly prompt: string;
  readonly expectedAnswers: ReadonlyArray<string>;
  readonly givenAnswer: string;
  readonly entryType: 'word' | 'expression' | 'sentence';
};
