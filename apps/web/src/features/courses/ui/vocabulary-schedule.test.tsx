import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VocabularyEntry } from '../schemas/course-units';
import { VocabularySchedule } from './vocabulary-schedule';

const entry: VocabularyEntry = {
  id: '00000000-0000-0000-0000-000000000001',
  unitId: '00000000-0000-0000-0000-000000000002',
  unitName: 'Unit 1',
  targetText: 'memory',
  nativeText: 'die Erinnerung',
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

describe('vocabulary schedule', () => {
  it('keeps a disabled direction out of the compact regular-plan status', () => {
    const markup = renderToStaticMarkup(
      <VocabularySchedule
        enabledDirections={['to_target']}
        entry={entry}
        exampleControl={null}
        now={new Date('2026-08-29T10:00:00Z')}
        targetLanguage="en"
      />,
    );

    expect(markup).toContain('31.08.2026 um 10:00');
    expect(markup).not.toContain('Richtungen fällig');
    expect(markup).toContain('Nicht im Lernplan');
  });
});
