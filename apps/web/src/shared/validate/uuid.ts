import { Schema } from 'effect';

// Effect 3's Schema.UUID only checked the dashed hexadecimal shape. Effect 4's
// isUUID also enforces the version and variant bits, which would reject IDs
// that were valid before, so this keeps the shape-only check.
export const Uuid = Schema.String.check(Schema.isGUID());
