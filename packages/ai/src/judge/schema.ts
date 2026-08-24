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
}).pipe(
  Schema.filter(
    (verdict) =>
      !verdict.acceptAsAlternative ||
      (verdict.correct && allDimensionsPass(verdict)),
    {
      message: () =>
        'An accepted alternative must be correct and pass every grading dimension.',
    },
  ),
);
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
