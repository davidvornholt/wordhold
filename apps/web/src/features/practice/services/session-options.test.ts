import { describe, expect, it } from 'bun:test';
import {
  directionOptions,
  directionsWithCards,
  offeredDirections,
  resolveAnswerDirection,
  resolveSessionDirection,
  sessionOptions,
} from './session-options';

const english = { kind: 'language', targetLanguage: 'en' } as const;
const counts = [
  { direction: 'to_target' as const, ready: 12 },
  { direction: 'to_native' as const, ready: 8 },
  { direction: 'both' as const, ready: 20 },
];
const targetCards = counts[0].ready;
const nativeCards = counts[1].ready;
const mixedCards = counts[2].ready;

describe('directionsWithCards', () => {
  it('offers only directions that have already been introduced into the selection', () => {
    expect(
      directionsWithCards([
        { direction: 'to_target' },
        { direction: 'to_target' },
      ]),
    ).toEqual(['to_target']);
  });
});

describe('sessionOptions', () => {
  it('offers a mixed sitting only when both directions are practised', () => {
    expect(
      sessionOptions(['to_target', 'to_native'], english, counts).map(
        (option) => option.value,
      ),
    ).toEqual(['to_target', 'to_native', 'both']);
  });

  it('drops a direction the course switched off, and the mix with it', () => {
    expect(
      sessionOptions(['to_native'], english, counts).map(
        (option) => option.value,
      ),
    ).toEqual(['to_native']);
  });

  it('keeps the German-first direction first however the course stores it', () => {
    expect(
      sessionOptions(['to_native', 'to_target'], english, counts).at(0)?.value,
    ).toBe('to_target');
  });

  it('shows the exact number of cards for every choice', () => {
    expect(
      sessionOptions(['to_target', 'to_native'], english, counts).map(
        ({ value, cards }) => [value, cards],
      ),
    ).toEqual([
      ['to_target', targetCards],
      ['to_native', nativeCards],
      ['both', mixedCards],
    ]);
  });

  it('disables mixed practice while only one direction has cards', () => {
    const options = sessionOptions(['to_target', 'to_native'], english, [
      { direction: 'to_target', ready: 7 },
      { direction: 'to_native', ready: 0 },
      { direction: 'both', ready: 7 },
    ]);
    expect(options.find((option) => option.value === 'both')).toMatchObject({
      availability: 'needs_two_directions',
      cards: 7,
    });
  });
});

describe('sessionOptions with synonyms and antonyms', () => {
  const allDirections = [
    'to_target',
    'to_native',
    'to_synonym',
    'to_antonym',
  ] as const;

  it('mixes the translations while no synonym or antonym is due', () => {
    const options = sessionOptions(allDirections, english, [
      ...counts,
      { direction: 'to_synonym', ready: 0 },
      { direction: 'to_antonym', ready: 0 },
    ]);
    expect(
      options.map(({ value, availability }) => [value, availability]),
    ).toEqual([
      ['to_target', 'available'],
      ['to_native', 'available'],
      ['to_synonym', 'no_cards'],
      ['to_antonym', 'no_cards'],
      ['both', 'available'],
    ]);
    expect(options.at(-1)?.description).toBe(
      'Alle Richtungen in einer Sitzung.',
    );
  });

  it('mixes a translation with synonyms', () => {
    const options = sessionOptions(['to_target', 'to_synonym'], english, [
      { direction: 'to_target', ready: 3 },
      { direction: 'to_synonym', ready: 2 },
      { direction: 'both', ready: 5 },
    ]);
    expect(options.at(-1)).toMatchObject({
      value: 'both',
      availability: 'available',
      description: 'Beide Richtungen in einer Sitzung.',
    });
  });
});

describe('offeredDirections', () => {
  it('offers synonyms and antonyms only where some word has such a list', () => {
    expect(
      offeredDirections(
        ['to_target', 'to_native', 'to_synonym', 'to_antonym'],
        [
          { direction: 'to_target' },
          { direction: 'to_synonym' },
          { direction: 'both' },
        ],
      ),
    ).toEqual(['to_target', 'to_native', 'to_synonym']);
  });
});

describe('directionOptions', () => {
  it('offers each direction separately without a mixed learning pass', () => {
    expect(
      directionOptions(['to_target', 'to_native'], english, counts).map(
        (option) => option.value,
      ),
    ).toEqual(['to_target', 'to_native']);
  });
});

describe('resolveAnswerDirection', () => {
  it('rejects a mixed learning pass and asks for one direction', () => {
    expect(
      resolveAnswerDirection('both', ['to_target', 'to_native']),
    ).toBeUndefined();
  });

  it('starts directly when only one learning direction remains', () => {
    expect(resolveAnswerDirection(undefined, ['to_native'])).toBe('to_native');
  });
});

describe('resolveSessionDirection', () => {
  it('honours a direction the course still practises', () => {
    expect(
      resolveSessionDirection(
        'to_native',
        ['to_target', 'to_native'],
        ['to_target', 'to_native'],
      ),
    ).toBe('to_native');
  });

  it('ignores a direction the course switched off', () => {
    expect(
      resolveSessionDirection('to_native', ['to_target'], ['to_target']),
    ).toBe('to_target');
  });

  it('refuses a mixed sitting when only one direction is left', () => {
    expect(resolveSessionDirection('both', ['to_target'], ['to_target'])).toBe(
      'to_target',
    );
  });

  it('refuses a mixed sitting while either direction has no cards', () => {
    expect(
      resolveSessionDirection(
        'both',
        ['to_target', 'to_native'],
        ['to_target'],
      ),
    ).toBeUndefined();
  });

  it('allows a mixed sitting once two of several directions have cards', () => {
    expect(
      resolveSessionDirection(
        'both',
        ['to_target', 'to_native', 'to_synonym'],
        ['to_native', 'to_synonym'],
      ),
    ).toBe('both');
  });

  it('asks first when nothing was requested and there is a choice', () => {
    expect(
      resolveSessionDirection(
        undefined,
        ['to_target', 'to_native'],
        ['to_target', 'to_native'],
      ),
    ).toBeUndefined();
  });

  it('starts directly when only one direction is available', () => {
    expect(
      resolveSessionDirection(undefined, ['to_target'], ['to_target']),
    ).toBe('to_target');
  });
});

describe('sessionOptions for a terms course', () => {
  it('names the only direction by what it asks for', () => {
    expect(
      sessionOptions(
        ['to_native'],
        { kind: 'terms', targetLanguage: 'de' },
        counts,
      ).map(({ label, description }) => [label, description]),
    ).toEqual([
      [
        'Begriff → Definition',
        'Du siehst den Begriff und schreibst seine Definition.',
      ],
    ]);
  });
});
