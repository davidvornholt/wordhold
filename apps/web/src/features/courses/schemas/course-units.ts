// A unit as the course page lists it. The two counts are what every screen
// about a unit needs: how much is in it, and how much of that the learner has
// never met.
export type CourseUnit = {
  readonly id: string;
  readonly name: string;
  readonly words: number;
  readonly unlearned: number;
};

// One word as the unit page shows it. `learned` is true once the learning pass
// has introduced the word, which is what decides whether a drill would ask it.
export type UnitWord = {
  readonly id: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly learned: boolean;
};

// How many of the unit's words have been through the learning pass, which is
// what a drill of the unit would ask about.
export const learnedWords = (unit: CourseUnit): number =>
  unit.words - unit.unlearned;

// What can be done with a unit. Learning needs words the learner has not met;
// drilling needs words already met. A unit in the middle offers both, and an
// empty unit offers neither.
export const unitOffers = (
  unit: CourseUnit,
): { readonly learn: boolean; readonly drill: boolean } => ({
  learn: unit.unlearned > 0,
  drill: learnedWords(unit) > 0,
});

// The course's own totals, summed from its units rather than queried again:
// every word belongs to exactly one unit, so the unit list already holds them.
export const courseTotals = (
  units: ReadonlyArray<CourseUnit>,
): { readonly words: number; readonly unlearned: number } =>
  units.reduce(
    (totals, unit) => ({
      words: totals.words + unit.words,
      unlearned: totals.unlearned + unit.unlearned,
    }),
    { words: 0, unlearned: 0 },
  );
