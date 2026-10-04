import type { AiOperation } from '@wordhold/ai/usage';
import type { Person, UsageRow } from './people-models';

const day = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dayAndTime = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export const personStatus = (person: Person): string => {
  if (person.admin) {
    return 'Administrator';
  }
  if (!person.enabled) {
    return 'Gesperrt';
  }
  return person.registered ? 'Aktiv' : 'Wartet auf die Einrichtung';
};

export const lastActive = (person: Pick<Person, 'lastActiveAt'>): string =>
  person.lastActiveAt === null
    ? 'Noch nie angemeldet'
    : `Zuletzt aktiv am ${day.format(person.lastActiveAt)}`;

export const codeExpiry = (expiresAt: Date): string =>
  `${dayAndTime.format(expiresAt)} Uhr`;

export const codeStatus = (code: NonNullable<Person['code']>): string =>
  `${code.kind === 'recovery' ? 'Wiederherstellungscode' : 'Einladung'} gültig bis ${codeExpiry(code.expiresAt)}`;

const operationLabels: Readonly<Record<AiOperation, string>> = {
  'page-extraction': 'Seiten auslesen',
  'answer-grading': 'Antworten bewerten',
  'definition-grading': 'Definitionen bewerten',
  'definition-key-points': 'Kernpunkte ableiten',
  'definition-suggestion': 'Definitionen vorschlagen',
  'sentence-grading': 'Sätze bewerten',
  'example-generation': 'Beispielsätze schreiben',
  'example-translation': 'Beispielsätze übersetzen',
  'word-translation': 'Wörter übersetzen',
  speech: 'Vorlesen',
};

const isOperation = (operation: string): operation is AiOperation =>
  Object.hasOwn(operationLabels, operation);

// The column stores plain text, so an unknown name is shown as stored.
export const operationLabel = (operation: string): string =>
  isOperation(operation) ? operationLabels[operation] : operation;

export const deletedPersonName = 'Gelöschte Konten';

export type PersonCosts = {
  readonly key: string;
  readonly name: string;
  readonly requests: number;
  readonly unknownCost: number;
  readonly estimatedUsd: number;
};

// One line per person, ordered like the rows, with deleted accounts last.
export const costsPerPerson = (
  rows: ReadonlyArray<UsageRow>,
): ReadonlyArray<PersonCosts> => {
  const totals = new Map<string, PersonCosts>();
  for (const row of rows) {
    const key = row.userId ?? 'deleted';
    const current = totals.get(key) ?? {
      key,
      name: row.name ?? deletedPersonName,
      requests: 0,
      unknownCost: 0,
      estimatedUsd: 0,
    };
    totals.set(key, {
      ...current,
      requests: current.requests + row.requests,
      unknownCost: current.unknownCost + row.unknownCost,
      estimatedUsd: current.estimatedUsd + row.estimatedUsd,
    });
  }
  return [...totals.values()];
};

const usd = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatUsd = (amount: number): string => usd.format(amount);
