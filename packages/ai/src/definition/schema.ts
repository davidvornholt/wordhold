import { Schema } from 'effect';
import { maximumEntryTextLength } from '../extraction/schema';

export const maximumKeyPoints = 4;
export const maximumKeyPointLength = 160;

export const KeyPointText = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumKeyPointLength),
);

// What an answer must state for a definition to count, one fact per point.
// The learner reviews and edits them, so they stay few and short.
export const KeyPoints = Schema.Array(KeyPointText).pipe(
  Schema.minItems(1),
  Schema.maxItems(maximumKeyPoints),
);

export const KeyPointList = Schema.Struct({ keyPoints: KeyPoints });
export type KeyPointListData = typeof KeyPointList.Type;

export const DefinitionSuggestion = Schema.Struct({
  definition: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumEntryTextLength),
  ),
});
export type DefinitionSuggestionData = typeof DefinitionSuggestion.Type;

const Finding = Schema.Struct({
  ok: Schema.Boolean,
  note: Schema.NullOr(Schema.String),
});

// A definition is graded point by point: `keyPoints` answers each stored key
// point in the order it was asked, and `accuracy` fails when the answer says
// something false. Correctness is derived from those findings instead of
// being a separate field the model could contradict.
export const DefinitionVerdict = Schema.Struct({
  keyPoints: Schema.Array(
    Schema.Struct({
      covered: Schema.Boolean,
      note: Schema.NullOr(Schema.String),
    }),
  ),
  accuracy: Finding,
  explanation: Schema.String,
});
export type DefinitionVerdictData = typeof DefinitionVerdict.Type;

export const isDefinitionCorrect = (verdict: DefinitionVerdictData): boolean =>
  verdict.keyPoints.every((point) => point.covered) && verdict.accuracy.ok;

export type DefinitionJudgeInput = {
  readonly term: string;
  readonly definition: string;
  readonly keyPoints: ReadonlyArray<string>;
  readonly givenAnswer: string;
};

export type KeyPointRequest = {
  readonly term: string;
  readonly definition: string;
};

export type DefinitionRequest = {
  readonly term: string;
  // The course name, such as "Chemie", which tells "Base" in chemistry apart
  // from a base in mathematics.
  readonly subject: string;
  // The book or unit name, when the term was filed under one.
  readonly topic?: string;
};
