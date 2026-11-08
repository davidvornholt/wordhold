import { Context } from 'effect';

/** The person a request acts for. */
export type Member = {
  readonly userId: string;
  readonly name: string;
  readonly admin: boolean;
};

export class CurrentMember extends Context.Service<CurrentMember, Member>()(
  '@wordhold/api/CurrentMember',
) {}
