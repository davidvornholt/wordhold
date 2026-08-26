import { describe, expect, it } from 'bun:test';
import { account, session, user, verification } from '@wordhold/db/schema/auth';
import { getAuthTables } from 'better-auth/db';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';

// better-auth builds its queries from the field names it declares, so a field
// missing from the Drizzle schema produces invalid SQL at sign-in rather than a
// type error at build time. This compares the two directly: whatever the
// installed better-auth version expects, the shared schema must provide.
const drizzleTables: Readonly<Record<string, PgTable>> = {
  user,
  session,
  account,
  verification,
};

const drizzleTableFor = (modelName: string): PgTable => {
  const table = drizzleTables[modelName];
  if (table === undefined) {
    throw new Error(
      `No Drizzle table matches better-auth model "${modelName}".`,
    );
  }
  return table;
};

const columnNameByField = (table: PgTable, field: string): string | undefined =>
  getTableColumns(table)[field]?.name;

const uniqueColumnSets = (table: PgTable): ReadonlyArray<string> =>
  getTableConfig(table)
    .indexes.filter((index) => index.config.unique)
    .map((index) =>
      index.config.columns
        .map((column) => ('name' in column ? String(column.name) : ''))
        .join(','),
    );

describe('better-auth database schema', () => {
  for (const [model, definition] of Object.entries(getAuthTables({}))) {
    const fields = Object.entries(definition.fields);

    it(`provides every column better-auth reads and writes on ${model}`, () => {
      const columns = getTableColumns(drizzleTableFor(definition.modelName));

      expect(
        fields
          .filter(([field]) => columns[field] === undefined)
          .map(([field]) => field),
      ).toEqual([]);
    });

    it(`rejects missing values in the required columns of ${model}`, () => {
      const columns = getTableColumns(drizzleTableFor(definition.modelName));

      expect(
        fields
          .filter(
            ([field, attributes]) =>
              attributes.required === true && columns[field]?.notNull !== true,
          )
          .map(([field]) => field),
      ).toEqual([]);
    });

    for (const index of (definition.indexes ?? []).filter(
      (entry) => entry.unique,
    )) {
      it(`enforces uniqueness of ${index.fields.join(', ')} on ${model}`, () => {
        const table = drizzleTableFor(definition.modelName);
        expect(uniqueColumnSets(table)).toContain(
          index.fields
            .map((field) => columnNameByField(table, field))
            .join(','),
        );
      });
    }
  }
});
