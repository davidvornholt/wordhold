import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { administratorGithubId, seedSampleData } from './sample-data-seed';

const rowCounts = Effect.gen(function* () {
  const sql = yield* Database;
  const tables = yield* sql<{ readonly name: string }>`
    select table_name as name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const [row] = yield* sql<{ readonly count: number }>`
      select count(*)::int as count from ${sql(table.name)}
    `;
    counts[table.name] = row?.count ?? 0;
  }
  return counts;
});

it('fills an empty database once, owned by the allowlisted GitHub account', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        // An abandoned GitHub sign-in leaves state behind, but no app data.
        yield* sql`insert into verification (id, identifier, value, expires_at)
          values ('state', 'github', 'pending', now() + interval '10 minutes')`;

        const seeded = yield* seedSampleData(new Date());
        expect(seeded).toMatchObject({ kind: 'seeded', people: 4 });

        const [owner] = yield* sql<{
          readonly userId: string;
          readonly admin: boolean;
          readonly enabled: boolean;
        }>`
          select m.user_id as "userId", m.admin, m.enabled
          from account a join members m on m.user_id = a.user_id
          where a.provider_id = 'github' and a.account_id = ${administratorGithubId}
        `;
        expect(owner).toMatchObject({ admin: true, enabled: true });

        const [practice] = yield* sql<{
          readonly due: number;
          readonly unmet: number;
          readonly answeredToday: number;
          readonly unintroducedRelations: number;
        }>`
          select
            count(*) filter (where ca.due_at <= now())::int as due,
            count(*) filter (where ca.introduced_at is null)::int as unmet,
            (select count(*)::int from reviews r
              join cards rc on rc.id = r.card_id
              join entries re on re.id = rc.entry_id
              join courses rco on rco.id = re.course_id
              where rco.owner_id = ${owner?.userId ?? ''}
                and r.reviewed_at > now() - interval '1 day') as "answeredToday",
            count(*) filter (
              where ca.direction in ('to_synonym', 'to_antonym')
                and ca.introduced_at is null
                and exists (select 1 from cards t
                  where t.entry_id = ca.entry_id and t.introduced_at is not null)
            )::int as "unintroducedRelations"
          from cards ca
          join entries e on e.id = ca.entry_id
          join courses c on c.id = e.course_id
          where c.owner_id = ${owner?.userId ?? ''}
        `;
        expect(practice?.due).toBeGreaterThan(10);
        expect(practice?.unmet).toBeGreaterThan(10);
        expect(practice?.answeredToday).toBeGreaterThan(5);
        expect(practice?.unintroducedRelations).toBe(0);

        const before = yield* rowCounts;
        expect(yield* seedSampleData(new Date())).toEqual({ kind: 'skipped' });
        expect(yield* rowCounts).toEqual(before);
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );
});
