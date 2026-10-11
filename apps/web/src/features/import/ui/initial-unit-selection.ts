import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';

const separator = '[^\\p{L}\\p{N}]+';
// One shared word, like "1" or "Holidays", is too weak to call two names the
// same unit.
const minimumSharedWords = 2;

// Letters and digits decide whether two names mean the same unit, so
// "Chapter 1 – The Time of Your Life" and "chapter 1: the time of your life"
// compare equal.
const nameWords = (name: string): ReadonlyArray<string> =>
  name
    .normalize('NFKC')
    .toLocaleLowerCase()
    .split(new RegExp(separator, 'u'))
    .filter((word) => word !== '');

const sameWords = (
  first: ReadonlyArray<string>,
  second: ReadonlyArray<string>,
): boolean =>
  first.length === second.length &&
  first.every((word, index) => word === second[index]);

const containsRun = (
  words: ReadonlyArray<string>,
  run: ReadonlyArray<string>,
): boolean =>
  run.length > 0 &&
  words.some((_, start) =>
    sameWords(words.slice(start, start + run.length), run),
  );

// Running heads often print the book title before the unit, as in
// "Context Starter · Chapter 1: The Time of Your Life". The unit is only the
// part after it; a heading that is nothing but the title names no unit.
const headingWithoutBookTitle = (heading: string, bookName: string): string => {
  const title = nameWords(bookName).join(separator);
  const trimmed = heading.normalize('NFKC').trim();
  if (title === '') {
    return trimmed;
  }
  if (sameWords(nameWords(trimmed), nameWords(bookName))) {
    return '';
  }
  return trimmed
    .replace(new RegExp(`^[^\\p{L}\\p{N}]*${title}${separator}`, 'iu'), '')
    .replace(new RegExp(`${separator}${title}[^\\p{L}\\p{N}]*$`, 'iu'), '')
    .trim();
};

// An exact name wins. Otherwise a unit whose name and the heading share a
// whole run of words is the same unit named shorter or longer, like
// "Chapter 1" for "Chapter 1: The Time of Your Life". The longest shared run
// decides, and among equals the latest unit, where the last page went.
const matchingUnit = (
  units: ReadonlyArray<Unit>,
  heading: string,
): Unit | undefined => {
  const headingWords = nameWords(heading);
  const exact = units.find((unit) =>
    sameWords(nameWords(unit.name), headingWords),
  );
  if (exact !== undefined) {
    return exact;
  }
  let best: { readonly unit: Unit; readonly sharedWords: number } | undefined;
  for (const unit of units) {
    const unitWords = nameWords(unit.name);
    const sharedWords = Math.min(unitWords.length, headingWords.length);
    const related =
      containsRun(headingWords, unitWords) ||
      containsRun(unitWords, headingWords);
    if (related && sharedWords >= (best?.sharedWords ?? minimumSharedWords)) {
      best = { unit, sharedWords };
    }
  }
  return best?.unit;
};

export const initialUnitSelection = (
  units: ReadonlyArray<Unit>,
  extractedUnitName: string | undefined,
  bookName: string,
): UnitSelectionData => {
  const realUnits = units.filter((unit) => !unit.isHolding);
  const unitName = headingWithoutBookTitle(extractedUnitName ?? '', bookName);
  if (unitName !== '') {
    const existingUnit = matchingUnit(realUnits, unitName);
    return existingUnit === undefined
      ? { kind: 'new', name: unitName }
      : { kind: 'existing', unitId: existingUnit.id };
  }

  // Without a heading on the page, words go where the last page went: the
  // latest unit, or directly into a book that has no units, like a novel.
  const latestRealUnit = realUnits.at(-1);
  return latestRealUnit === undefined
    ? { kind: 'none' }
    : { kind: 'existing', unitId: latestRealUnit.id };
};
