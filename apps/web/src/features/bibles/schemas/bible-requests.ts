import { Schema } from 'effect';

// A typed reference is short; anything longer is not one.
const maximumReferenceLength = 100;

export const PassageLookup = Schema.Struct({
  bibleId: Schema.UUID,
  reference: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumReferenceLength),
  ),
});

export const BibleRemoval = Schema.Struct({
  bibleId: Schema.UUID,
});

export const decodePassageLookup = Schema.decodeUnknownSync(PassageLookup);
export const decodeBibleRemoval = Schema.decodeUnknownSync(BibleRemoval);
