import { describe, expect, it } from 'bun:test';
import {
  codeStatus,
  costsPerPerson,
  deletedPersonName,
  formatUsd,
  lastActive,
  operationLabel,
  personStatus,
} from './people-labels';
import type { Person, UsageRow } from './people-models';

const person = (overrides: Partial<Person>): Person => ({
  userId: 'anna',
  name: 'Anna',
  admin: false,
  enabled: true,
  registered: true,
  code: null,
  lastActiveAt: null,
  ...overrides,
});

const usageRow = (overrides: Partial<UsageRow>): UsageRow => ({
  userId: 'anna',
  name: 'Anna',
  operation: 'speech',
  provider: 'polly',
  model: 'generative',
  requests: 1,
  failed: 0,
  unknownCost: 0,
  estimatedUsd: 0,
  ...overrides,
});

describe('personStatus', () => {
  it('names the administrator, suspended, active and pending people', () => {
    expect(personStatus(person({ admin: true, enabled: false }))).toBe(
      'Administrator',
    );
    expect(personStatus(person({ enabled: false }))).toBe('Gesperrt');
    expect(personStatus(person({}))).toBe('Aktiv');
    expect(personStatus(person({ registered: false }))).toBe(
      'Wartet auf die Einrichtung',
    );
  });
});

describe('lastActive', () => {
  it('says when the person last used Wordhold', () => {
    expect(lastActive({ lastActiveAt: null })).toBe('Noch nie angemeldet');
    expect(
      lastActive({ lastActiveAt: new Date('2026-10-04T12:00:00.000Z') }),
    ).toBe('Zuletzt aktiv am 4. Oktober 2026');
  });
});

describe('codeStatus', () => {
  it('names the kind of code and when it expires', () => {
    const expiresAt = new Date('2026-10-04T12:00:00.000Z');

    expect(codeStatus({ kind: 'invitation', expiresAt })).toStartWith(
      'Einladung gültig bis 4. Oktober',
    );
    expect(codeStatus({ kind: 'recovery', expiresAt })).toStartWith(
      'Wiederherstellungscode gültig bis 4. Oktober',
    );
    expect(codeStatus({ kind: 'recovery', expiresAt })).toEndWith(' Uhr');
  });
});

describe('operationLabel', () => {
  it('describes known operations and shows unknown ones as stored', () => {
    expect(operationLabel('page-extraction')).toBe('Seiten auslesen');
    expect(operationLabel('retired-operation')).toBe('retired-operation');
  });
});

describe('costsPerPerson', () => {
  it('adds up each person in row order and keeps deleted accounts apart', () => {
    expect(
      costsPerPerson([
        usageRow({ requests: 2, estimatedUsd: 0.25 }),
        usageRow({ operation: 'page-extraction', unknownCost: 1 }),
        usageRow({ userId: 'ben', name: 'Ben', estimatedUsd: 0.5 }),
        usageRow({ userId: null, name: null, estimatedUsd: 1 }),
      ]),
    ).toEqual([
      {
        key: 'anna',
        name: 'Anna',
        requests: 3,
        unknownCost: 1,
        estimatedUsd: 0.25,
      },
      {
        key: 'ben',
        name: 'Ben',
        requests: 1,
        unknownCost: 0,
        estimatedUsd: 0.5,
      },
      {
        key: 'deleted',
        name: deletedPersonName,
        requests: 1,
        unknownCost: 0,
        estimatedUsd: 1,
      },
    ]);
  });
});

describe('formatUsd', () => {
  it('keeps fractions of a cent', () => {
    // German currency formatting puts a no-break space before the sign.
    expect(formatUsd(0.0012)).toBe('0,0012\u00a0$');
    expect(formatUsd(2)).toBe('2,00\u00a0$');
  });
});
