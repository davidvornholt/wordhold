import { describe, expect, it } from 'bun:test';
import type { UnitEntry } from '../services/repository';
import { assessDraftDuplicates } from './draft-duplicates';

const unitId = '11111111-1111-4111-8111-111111111111';

const storedJourney: UnitEntry = {
  unitId,
  location: 'Encuentros hoy 2 · U1 Acércate',
  targetText: 'journey',
  examples: ['The journey takes three hours.'],
};

const draft = (targetText: string, example = '') => ({
  targetText,
  nativeText: 'Reise',
  example,
});

const verdicts = (
  drafts: ReadonlyArray<ReturnType<typeof draft>>,
  stored: ReadonlyArray<UnitEntry>,
) => assessDraftDuplicates(drafts, stored).map(({ verdict }) => verdict);

describe('assessDraftDuplicates', () => {
  it('names the book and unit that already hold a stored word', () => {
    expect(
      assessDraftDuplicates(
        [
          draft('journey!', 'The journey takes three hours.'),
          draft('Journey'),
          draft('trip'),
        ],
        [storedJourney],
      ),
    ).toEqual([
      { verdict: 'exact', location: 'Encuentros hoy 2 · U1 Acércate' },
      { verdict: 'exception', location: 'Encuentros hoy 2 · U1 Acércate' },
      { verdict: 'none' },
    ]);
  });

  it('flags the second occurrence of a word within one page', () => {
    expect(
      assessDraftDuplicates(
        [draft('voyage'), draft('voyage'), draft('Voyage')],
        [],
      ),
    ).toEqual([
      { verdict: 'none' },
      { verdict: 'exact', location: null },
      { verdict: 'exception', location: null },
    ]);
  });

  it('keeps incomplete rows out of the pool but still warns while typing', () => {
    const incomplete = { ...draft('voyage'), nativeText: ' ' };
    expect(verdicts([incomplete, draft('voyage')], [])).toEqual([
      'none',
      'none',
    ]);
    expect(
      verdicts(
        [incomplete],
        [
          {
            unitId,
            location: 'Buch 1 · U1',
            targetText: 'voyage',
            examples: [],
          },
        ],
      ),
    ).toEqual(['exact']);
  });
});
