import type { AccessCodeKind } from '@wordhold/db/schema/members';
import { Option, Schema } from 'effect';

export const maximumPersonNameLength = 80;
const maximumUserIdLength = 100;

export type Person = {
  readonly userId: string;
  readonly name: string;
  readonly admin: boolean;
  readonly enabled: boolean;
  // Whether the person has saved a passkey; the administrator signs in with
  // GitHub and counts as registered.
  readonly registered: boolean;
  readonly code: {
    readonly kind: AccessCodeKind;
    readonly expiresAt: Date;
  } | null;
  readonly lastActiveAt: Date | null;
};

// Shown once after it is issued; only its digest is stored.
export type IssuedCode = {
  readonly userId: string;
  readonly name: string;
  readonly kind: AccessCodeKind;
  readonly code: string;
  readonly expiresAt: Date;
};

// One person's requests for one operation and model in the chosen period.
// Requests of deleted people keep counting with `userId` null.
export type UsageRow = {
  readonly userId: string | null;
  readonly name: string | null;
  readonly operation: string;
  readonly provider: string;
  readonly model: string;
  readonly requests: number;
  readonly failed: number;
  readonly unknownCost: number;
  readonly estimatedUsd: number;
};

const week = 7;
const month = 30;
const year = 365;
export const usagePeriods = [week, month, year] as const;
export type UsagePeriod = (typeof usagePeriods)[number];
export const defaultUsagePeriod: UsagePeriod = month;

const PersonName = Schema.Trim.check(
  Schema.isMinLength(1, { message: 'Gib einen Namen ein.' }),
  Schema.isMaxLength(maximumPersonNameLength, {
    message: `Ein Name hat höchstens ${maximumPersonNameLength} Zeichen.`,
  }),
);

const UserId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumUserIdLength),
);

export const decodeInvitation = Schema.decodeUnknownSync(
  Schema.Struct({ name: PersonName }),
);

export const decodeUserId = Schema.decodeUnknownSync(UserId);

export const decodeAccessChange = Schema.decodeUnknownSync(
  Schema.Struct({ userId: UserId, enabled: Schema.Boolean }),
);

const UsagePeriodSchema = Schema.Literals(usagePeriods);
export const decodeUsagePeriod = Schema.decodeUnknownSync(UsagePeriodSchema);

export type PeopleSearch = { readonly days?: UsagePeriod };

const decodePeopleSearch = Schema.decodeUnknownOption(
  Schema.Struct({ days: Schema.optional(UsagePeriodSchema) }),
);

// An unknown period in the address falls back to the default one.
export const parsePeopleSearch = (input: unknown): PeopleSearch =>
  Option.getOrElse(decodePeopleSearch(input), (): PeopleSearch => ({}));
