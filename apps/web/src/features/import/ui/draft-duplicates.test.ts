import { describe, expect, it } from 'bun:test';
import type { Unit, UnitEntry } from '../services/repository';
import { assessDraftDuplicates } from './draft-duplicates';

const unitId = '11111111-1111-4111-8111-111111111111';
const otherUnitId = '22222222-2222-4222-8222-222222222222';

const units: ReadonlyArray<Unit> = [
  { id: unitId, name: 'Unit 2', position: 0, isHolding: false, entryCount: 1 },
];

const storedJourney: UnitEntry = {
  unitId,
  targetText: 'journey',
  examples: ['The journey takes three hours.'],
};

const draft = (
  targetText: string,
  unit:
    | { readonly kind: 'existing'; readonly unitId: string }
    | { readonly kind: 'new'; readonly name: string },
  example = '',
) => ({ targetText, nativeText: 'Reise', example, unit });

const existing = { kind: 'existing', unitId } as const;

describe('assessDraftDuplicates', () => {
  it('flags a stored word only in its own unit', () => {
    expect(
      assessDraftDuplicates(
        [
          draft('journey!', existing, 'The journey takes three hours.'),
          draft('journey', { kind: 'existing', unitId: otherUnitId }),
        ],
        units,
        [storedJourney],
      ),
    ).toEqual(['exact', 'none']);
  });

  it('routes a typed unit name into the matching unit pool by exact name', () => {
    expect(
      assessDraftDuplicates(
        [
          draft('journey', { kind: 'new', name: ' Unit 2 ' }, 'A new trip.'),
          draft('journey', { kind: 'new', name: 'unit 2' }, 'A new trip.'),
        ],
        units,
        [storedJourney],
      ),
    ).toEqual(['exception', 'none']);
  });

  it('flags the second occurrence of a word within one page', () => {
    expect(
      assessDraftDuplicates(
        [
          draft('voyage', { kind: 'new', name: 'Unit 9' }),
          draft('voyage', { kind: 'new', name: 'Unit 9' }),
          draft('Voyage', { kind: 'new', name: 'Unit 9' }),
        ],
        units,
        [],
      ),
    ).toEqual(['none', 'exact', 'exception']);
  });

  it('keeps incomplete rows out of the pool but still warns while typing', () => {
    const incomplete = { ...draft('voyage', existing), nativeText: ' ' };
    expect(
      assessDraftDuplicates([incomplete, draft('voyage', existing)], units, []),
    ).toEqual(['none', 'none']);
    expect(
      assessDraftDuplicates([incomplete], units, [
        { unitId, targetText: 'voyage', examples: [] },
      ]),
    ).toEqual(['exact']);
  });
});
