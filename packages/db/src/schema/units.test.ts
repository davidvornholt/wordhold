import { describe, expect, it } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { entries } from './entries';
import { units } from './units';

describe('units', () => {
  // Two photos of the same chapter must land in one unit. Import resolves a
  // typed name to the existing unit, and this constraint is what makes that
  // resolution safe instead of a race that creates a duplicate chapter.
  it('keeps names and positions unique inside a course', () => {
    const unique = getTableConfig(units)
      .indexes.filter((index) => index.config.unique)
      .map((index) =>
        index.config.columns
          .map((column) => ('name' in column ? String(column.name) : ''))
          .join(','),
      );

    expect(unique).toContain('course_id,name');
    expect(unique).toContain('course_id,position');
    expect(unique).toContain('id,course_id');
  });

  it('requires every vocabulary entry to belong to a unit', () => {
    const unitId = getTableConfig(entries).columns.find(
      (column) => column.name === 'unit_id',
    );

    expect(unitId?.notNull).toBe(true);
  });

  // Deleting a chapter must not be a way to lose vocabulary by accident, so
  // the database refuses the delete while words still point at it.
  it('refuses to delete a unit that still holds vocabulary', () => {
    const [key] = getTableConfig(entries).foreignKeys.filter((foreignKey) =>
      foreignKey
        .reference()
        .columns.some((column) => column.name === 'unit_id'),
    );

    expect(key?.reference().foreignTable).toBe(units);
    expect(key?.reference().columns.map((column) => column.name)).toEqual([
      'unit_id',
      'course_id',
    ]);
    expect(
      key?.reference().foreignColumns.map((column) => column.name),
    ).toEqual(['id', 'course_id']);
    expect(key?.onDelete).toBe('restrict');
  });
});
