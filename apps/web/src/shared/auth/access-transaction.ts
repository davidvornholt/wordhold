// biome-ignore lint/correctness/noNodejsModules: Auth transactions run only on the server.
import { AsyncLocalStorage } from 'node:async_hooks';
import { sql, TransactionRollbackError } from 'drizzle-orm';
import { db } from '../db/server';
import { commitsResult } from './auth-commit';

type AuthDatabase = typeof db;
type AccessTransaction = Parameters<
  Parameters<AuthDatabase['transaction']>[0]
>[0];

const currentTransaction = new AsyncLocalStorage<AccessTransaction>();

// Better Auth, its plugins and the access checks in their hooks all read and
// write through this client, so inside an access transaction they see each
// other's rows and commit or roll back together.
export const authDb = new Proxy(db, {
  get(target, property) {
    const connection: AuthDatabase | AccessTransaction =
      currentTransaction.getStore() ?? target;
    const value: unknown = Reflect.get(connection, property, connection);
    return typeof value === 'function' ? value.bind(connection) : value;
  },
});

// Serializes sign-ins, passkey registrations and account changes across
// server processes, so a code is redeemed once and a suspension cannot race a
// registration. `commits` decides whether the outermost transaction keeps the
// work's writes; by default an error response rolls back.
export const withAccessTransaction = async <A>(
  work: () => Promise<A>,
  commits: (result: A) => boolean | Promise<boolean> = commitsResult,
): Promise<A> => {
  if (currentTransaction.getStore() !== undefined) {
    return work();
  }
  let rejected: { readonly result: A } | undefined;
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('wordhold:access', 0))`,
      );
      const result = await currentTransaction.run(transaction, work);
      if (!(await commits(result))) {
        rejected = { result };
        transaction.rollback();
      }
      return result;
    });
  } catch (error) {
    if (rejected !== undefined && error instanceof TransactionRollbackError) {
      return rejected.result;
    }
    throw error;
  }
};
