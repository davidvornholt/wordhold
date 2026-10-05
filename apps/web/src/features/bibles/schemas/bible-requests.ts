import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';

// A typed reference is short; anything longer is not one.
const maximumReferenceLength = 100;

export const PassageLookup = Schema.Struct({
  bibleId: Uuid,
  reference: Schema.Trim.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maximumReferenceLength),
  ),
});

export const BibleRemoval = Schema.Struct({
  bibleId: Uuid,
});

export const decodePassageLookup = Schema.decodeUnknownSync(PassageLookup);
export const decodeBibleRemoval = Schema.decodeUnknownSync(BibleRemoval);
