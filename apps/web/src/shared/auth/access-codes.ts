import type { makeDrizzle } from '@wordhold/db/drizzle';
import { APIError } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import { codeDigest } from './code-secrets';

// The passkey plugin passes the access transaction's client, so a redemption
// commits or rolls back together with the passkey it stores.
type CodeDatabase = Pick<ReturnType<typeof makeDrizzle>, 'execute'>;

const maximumCodeLength = 100;

const invalidCode = () =>
  new APIError('BAD_REQUEST', {
    message:
      'Dieser Code ist ungültig oder abgelaufen. Bitte frag nach einem neuen.',
  });

// The person a valid invitation or recovery code belongs to. The
// administrator signs in with GitHub and never receives a code.
export const resolveAccessCode = async (
  database: CodeDatabase,
  code: string | null,
) => {
  if (code === null || code.trim() === '' || code.length > maximumCodeLength) {
    throw invalidCode();
  }
  const rows = await database.execute<{ userId: string; name: string }>(
    sql`select m.user_id as "userId", m.name
      from access_codes c join members m on m.user_id = c.user_id
      where c.digest = ${await codeDigest(code)} and c.expires_at > now()
        and m.enabled and not m.admin`,
  );
  const [member] = rows;
  if (member === undefined) {
    throw invalidCode();
  }
  return { id: member.userId, name: member.name, displayName: member.name };
};

// Runs after the new passkey was verified and in the same access transaction
// that stores it, so of two concurrent redemptions exactly one succeeds. A
// recovery code replaces every earlier passkey and signs out every device.
export const consumeAccessCode = async (
  database: CodeDatabase,
  code: string,
  userId: string,
): Promise<void> => {
  const rows = await database.execute<{ kind: string }>(
    sql`delete from access_codes c using members m
      where c.user_id = m.user_id and c.digest = ${await codeDigest(code)}
        and c.expires_at > now() and m.user_id = ${userId}
        and m.enabled and not m.admin
      returning c.kind`,
  );
  const [consumed] = rows;
  if (consumed === undefined) {
    throw invalidCode();
  }
  if (consumed.kind === 'recovery') {
    await database.execute(sql`delete from session where user_id = ${userId}`);
    await database.execute(sql`delete from passkey where user_id = ${userId}`);
  }
};
