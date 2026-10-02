import { Schema } from 'effect';

// A translated sentence is graded on four findings, and correctness is
// derived from them instead of being a separate field the model could
// contradict. `correction` is the learner's own sentence with the fewest
// changes that make it pass, which shows the mistake more plainly than a
// reference written from scratch. It stays a plain string: a verdict with an
// odd correction still carries an explanation worth showing.
export const SentenceVerdict = Schema.Struct({
  meaningKept: Schema.Boolean,
  grammatical: Schema.Boolean,
  spelledCorrectly: Schema.Boolean,
  wordUsed: Schema.Boolean,
  correction: Schema.NullOr(Schema.String),
  explanation: Schema.String,
});
export type SentenceVerdictData = typeof SentenceVerdict.Type;

export const isSentenceCorrect = (verdict: SentenceVerdictData): boolean =>
  verdict.meaningKept &&
  verdict.grammatical &&
  verdict.spelledCorrectly &&
  verdict.wordUsed;

export type SentenceJudgeInput = {
  // The English name of the language the learner writes in, such as "Spanish".
  readonly targetLanguage: string;
  // The German sentence the learner translates.
  readonly sentence: string;
  // One valid translation, usually the textbook's or the generated example.
  readonly reference: string;
  // The vocabulary item the sentence practises, as the word list prints it.
  readonly word: {
    readonly target: string;
    readonly german: string;
  };
  readonly givenAnswer: string;
};
