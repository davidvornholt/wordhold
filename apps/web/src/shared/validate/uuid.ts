import { Schema } from 'effect';

// Checks the version and RFC variant bits, not only the dashed hexadecimal
// shape. Every ID wordhold stores comes from gen_random_uuid() or
// crypto.randomUUID(), which both produce version 4 UUIDs.
export const Uuid = Schema.String.check(Schema.isUUID());
