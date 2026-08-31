import type { UnitSelectionData } from '../schemas/import-payload';
import {
  type DuplicateVerdict,
  duplicateVerdict,
  type ExistingEntry,
} from '../services/entry-identity';
import type { Unit, UnitEntry } from '../services/repository';

export type AssessableDraft = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
  readonly unit: UnitSelectionData;
};

// The server resolves a new unit name by exact match against the course's
// units, so the assessment mirrors that: a typed name that equals an existing
// unit's name lands in that unit's pool, any other name starts an empty one.
const unitPoolKey = (
  unit: UnitSelectionData,
  units: ReadonlyArray<Unit>,
): string | undefined => {
  if (unit.kind === 'existing') {
    return unit.unitId;
  }
  const name = unit.name.trim();
  if (name === '') {
    return undefined;
  }
  return (
    units.find((candidate) => candidate.name === name)?.id ?? `new:${name}`
  );
};

const draftIsImported = (draft: AssessableDraft): boolean =>
  draft.targetText.trim() !== '' && draft.nativeText.trim() !== '';

// Verdicts for every row of the verify form, in order. Earlier importable
// rows join their unit's pool so a page listing one word twice flags the
// second occurrence, matching the server-side check.
export const assessDraftDuplicates = (
  drafts: ReadonlyArray<AssessableDraft>,
  units: ReadonlyArray<Unit>,
  unitEntries: ReadonlyArray<UnitEntry>,
): ReadonlyArray<DuplicateVerdict> => {
  const pools = new Map<string, Array<ExistingEntry>>();
  for (const entry of unitEntries) {
    const pool = pools.get(entry.unitId) ?? [];
    pool.push({ targetText: entry.targetText, examples: entry.examples });
    pools.set(entry.unitId, pool);
  }
  return drafts.map((draft) => {
    const key = unitPoolKey(draft.unit, units);
    if (key === undefined) {
      return 'none';
    }
    const pool = pools.get(key) ?? [];
    const verdict = duplicateVerdict(
      { targetText: draft.targetText, example: draft.example },
      pool,
    );
    if (draftIsImported(draft)) {
      pool.push({
        targetText: draft.targetText,
        examples: draft.example.trim() === '' ? [] : [draft.example],
      });
      pools.set(key, pool);
    }
    return verdict;
  });
};
