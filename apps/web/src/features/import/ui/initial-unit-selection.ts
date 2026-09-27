import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';

const comparableUnitName = (name: string): string =>
  name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase();

export const initialUnitSelection = (
  units: ReadonlyArray<Unit>,
  extractedUnitName: string | undefined,
): UnitSelectionData => {
  const unitName = extractedUnitName?.trim();
  if (unitName !== undefined && unitName !== '') {
    const comparableName = comparableUnitName(unitName);
    const existingUnit = units.find(
      (unit) =>
        !unit.isHolding && comparableUnitName(unit.name) === comparableName,
    );
    return existingUnit === undefined
      ? { kind: 'new', name: unitName }
      : { kind: 'existing', unitId: existingUnit.id };
  }

  // Without a heading on the page, words go where the last page went: the
  // latest unit, or directly into a book that has no units, like a novel.
  const latestRealUnit = units.findLast((unit) => !unit.isHolding);
  return latestRealUnit === undefined
    ? { kind: 'none' }
    : { kind: 'existing', unitId: latestRealUnit.id };
};
