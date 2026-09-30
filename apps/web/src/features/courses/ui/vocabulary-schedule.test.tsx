import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VocabularyEntry } from '../schemas/course-units';
import { ScheduleItems } from './vocabulary-schedule';
import { scheduleSummary } from './vocabulary-schedule-status';

const entry: VocabularyEntry = {
  id: '00000000-0000-0000-0000-000000000001',
  bookId: '00000000-0000-0000-0000-000000000009',
  bookName: 'Green Line 3',
  unitId: '00000000-0000-0000-0000-000000000002',
  unitName: 'Unit 1',
  targetText: 'memory',
  nativeText: 'die Erinnerung',
  keyPoints: null,
  example: null,
  introduced: true,
  cards: [
    {
      cardId: '00000000-0000-0000-0000-000000000003',
      direction: 'to_target',
      state: 'review',
      dueAt: new Date('2026-08-31T10:00:00Z'),
      introducedAt: new Date('2026-08-20T10:00:00Z'),
      failures: 0,
    },
    {
      cardId: '00000000-0000-0000-0000-000000000004',
      direction: 'to_native',
      state: 'review',
      dueAt: new Date('2026-08-28T10:00:00Z'),
      introducedAt: new Date('2026-08-20T10:00:00Z'),
      failures: 1,
    },
  ],
};

const now = new Date('2026-08-29T10:00:00Z');

describe('vocabulary schedule', () => {
  it('keeps a disabled direction out of the compact regular-plan status', () => {
    const summary = scheduleSummary(entry, ['to_target'], now);

    expect(summary).toContain('31.08.2026 um 10:00');
    expect(summary).not.toContain('Richtungen fällig');
  });

  it('lists a disabled direction as outside the plan', () => {
    const markup = renderToStaticMarkup(
      <dl>
        <ScheduleItems
          enabledDirections={['to_target']}
          entry={entry}
          now={now}
          subject={{ kind: 'language', targetLanguage: 'en' }}
        />
      </dl>,
    );

    expect(markup).toContain('31.08.2026 um 10:00');
    expect(markup).toContain('Nicht im Lernplan');
    expect(markup).toContain('1× nicht gewusst');
  });
});
