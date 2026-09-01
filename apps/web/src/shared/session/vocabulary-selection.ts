import { Schema } from 'effect';

export const VocabularySelection = Schema.Union(
  Schema.Struct({ unitId: Schema.UUID }),
  Schema.Struct({
    entryIds: Schema.Array(Schema.UUID).pipe(Schema.minItems(1)),
  }),
);

export type VocabularySelectionData = typeof VocabularySelection.Type;
