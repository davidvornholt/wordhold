import { describe, expect, it } from 'bun:test';
import type { CourseUnit } from '../schemas/course-units';
import { unitPracticeStatus, unitProgressSummary } from './unit-status';

const vocabularyCount = 12;
const reverseIntroduced = 9;

const unit = (overrides: Partial<CourseUnit>): CourseUnit => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 1',
  entries: 10,
  introduced: 10,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  directions: [],
  ...overrides,
});

const progress = (
  direction: CourseUnit['directions'][number]['direction'],
  introduced: number,
  total: number,
): CourseUnit['directions'][number] => ({
  direction,
  total,
  introduced,
  unintroduced: total - introduced,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
});

describe('unitPracticeStatus', () => {
  it('reports due reviews first, with singular grammar', () => {
    expect(unitPracticeStatus(unit({ due: 1, firstReviews: 3 }))).toBe(
      '1 Wiederholung offen',
    );
  });

  it('reports first reviews when nothing is due', () => {
    expect(unitPracticeStatus(unit({ firstReviews: 2 }))).toBe(
      '2 Karten zum ersten Mal üben',
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
    expect(
      unitProgressSummary(unit({ entries: 0, introduced: 0 }), 'Englisch'),
    ).toBe('Noch keine Vokabeln');
  });

  it('makes different progress in both directions visible', () => {
    expect(
      unitProgressSummary(
        unit({
          entries: vocabularyCount,
          introduced: vocabularyCount,
          unintroduced: 3,
          due: 2,
          directions: [
            progress('to_target', vocabularyCount, vocabularyCount),
            progress('to_native', reverseIntroduced, vocabularyCount),
          ],
        }),
        'Englisch',
      ),
    ).toBe(
      '12 Vokabeln · Deutsch → Englisch 12/12 · Englisch → Deutsch 9/12 · 3 Vokabeln noch kennenlernen · 2 Wiederholungen offen',
    );
  });

  it('does not call an untouched unit finished', () => {
    expect(
      unitProgressSummary(
        unit({
          entries: vocabularyCount,
          introduced: 0,
          unintroduced: vocabularyCount,
          directions: [
            progress('to_target', 0, vocabularyCount),
            progress('to_native', 0, vocabularyCount),
          ],
        }),
        'Englisch',
      ),
    ).toBe(
      '12 Vokabeln · Deutsch → Englisch 0/12 · Englisch → Deutsch 0/12 · 12 Vokabeln noch kennenlernen',
    );
  });

  it('summarizes a fully introduced single-direction unit', () => {
    expect(
      unitProgressSummary(
        unit({
          entries: 1,
          introduced: 1,
          directions: [progress('to_target', 1, 1)],
        }),
        'Englisch',
      ),
    ).toBe('1 Vokabel · Deutsch → Englisch 1/1 · Für jetzt geschafft');
  });
});
