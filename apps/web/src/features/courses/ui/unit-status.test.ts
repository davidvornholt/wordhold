import { describe, expect, it } from 'bun:test';
import type { CourseUnit } from '../schemas/course-units';
import { unitPracticeStatus, unitProgressSummary } from './unit-status';

const unit = (overrides: Partial<CourseUnit>): CourseUnit => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 1',
  entries: 10,
  introduced: 10,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  ...overrides,
});

describe('unitPracticeStatus', () => {
  it('reports due reviews first, with singular grammar', () => {
    expect(unitPracticeStatus(unit({ due: 1, firstReviews: 3 }))).toBe(
      '1 Wiederholung offen',
    );
  });

  it('reports first reviews when nothing is due', () => {
    expect(unitPracticeStatus(unit({ firstReviews: 2 }))).toBe(
      '2 erste Abfragen offen',
    );
  });

  it('reports rest when nothing is scheduled', () => {
    expect(unitPracticeStatus(unit({}))).toBe('Für jetzt geschafft');
  });

  it('names the next date when work is only scheduled later', () => {
    expect(
      unitPracticeStatus(unit({ nextDueAt: new Date('2099-01-01') })),
    ).toStartWith('Nächster Termin');
  });
});

describe('unitProgressSummary', () => {
  it('reports an empty unit without practice status', () => {
    expect(unitProgressSummary(unit({ entries: 0, introduced: 0 }))).toBe(
      'Noch keine Vokabeln',
    );
  });

  it('counts remaining introductions', () => {
    expect(
      unitProgressSummary(
        unit({ entries: 12, introduced: 9, unintroduced: 3, due: 2 }),
      ),
    ).toBe('12 Vokabeln · 3 noch kennenlernen · 2 Wiederholungen offen');
  });

  it('marks a fully introduced unit', () => {
    expect(unitProgressSummary(unit({ entries: 1, introduced: 1 }))).toBe(
      '1 Vokabel · alle kennengelernt · Für jetzt geschafft',
    );
  });
});
