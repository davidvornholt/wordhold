import { describe, expect, it } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { books } from './books';
import { entries } from './entries';
import { units } from './units';

describe('units', () => {
  // Two photos of the same chapter must land in one unit, while two books of
  // one course may each have a chapter with the same name. Import resolves a
  // typed name to the existing unit, and this constraint is what makes that
  // resolution safe instead of a race that creates a duplicate chapter.
  it('keeps names and positions unique inside a book', () => {
    const unique = getTableConfig(units)
      .indexes.filter((index) => index.config.unique)
      .map((index) =>
        index.config.columns
          .map((column) => ('name' in column ? String(column.name) : ''))
          .join(','),
      );

    expect(unique).toContain('book_id,name');
    expect(unique).toContain('book_id,position');
    expect(unique).toContain('id,course_id');
    expect(unique).toContain('id,book_id');
  });

  // A novel has no chapters worth naming, so its words live directly in the
  // book.
  it('lets a vocabulary entry live directly in its book', () => {
    const unitId = getTableConfig(entries).columns.find(
      (column) => column.name === 'unit_id',
    );

    expect(unitId?.notNull).toBe(false);
  });

  // Deleting a book or chapter must not be a way to lose vocabulary by
  // accident, so the database refuses the delete while entries still point at
  // it. The unit key also keeps a word's unit inside the word's book.
  it('refuses to delete a book or unit that still holds vocabulary', () => {
    const keys = getTableConfig(entries).foreignKeys.map((foreignKey) => ({
      table: foreignKey.reference().foreignTable,
      columns: foreignKey.reference().columns.map((column) => column.name),
      foreignColumns: foreignKey
        .reference()
        .foreignColumns.map((column) => column.name),
      onDelete: foreignKey.onDelete,
    }));

    expect(keys).toContainEqual({
      table: books,
      columns: ['book_id', 'course_id'],
      foreignColumns: ['id', 'course_id'],
      onDelete: 'restrict',
    });
    expect(keys).toContainEqual({
      table: units,
      columns: ['unit_id', 'book_id'],
      foreignColumns: ['id', 'book_id'],
      onDelete: 'restrict',
    });
  });
});
