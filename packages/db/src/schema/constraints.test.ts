import { describe, expect, it } from 'bun:test';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { acceptedAnswers, entryAudio } from './entries';
import { cards, judgeCache } from './practice';

// These unique constraints are load-bearing for grading: they are what makes
// deterministic-match lookups and judge-cache hits idempotent. Losing one in
// a schema refactor would silently duplicate rows instead of failing loudly.
const uniqueColumnSets = (table: PgTable): ReadonlyArray<string> =>
  getTableConfig(table)
    .indexes.filter((index) => index.config.unique)
    .map((index) =>
      index.config.columns
        .map((column) => ('name' in column ? String(column.name) : ''))
        .join(','),
    );

describe('grading-critical unique constraints', () => {
  it('dedupes accepted answers per entry and direction', () => {
    expect(uniqueColumnSets(acceptedAnswers)).toContain(
      'entry_id,direction,normalized',
    );
  });

  it('caches judge verdicts per normalized answer', () => {
    expect(uniqueColumnSets(judgeCache)).toContain(
      'entry_id,direction,normalized_answer',
    );
  });

  it('schedules one card per entry and direction', () => {
    expect(uniqueColumnSets(cards)).toContain('entry_id,direction');
  });

  it('stores one audio file per entry and voice', () => {
    expect(uniqueColumnSets(entryAudio)).toContain('entry_id,voice');
  });
});
