// A unit as the course page lists it. The two counts are what every screen
// about a unit needs: how much is in it, and how much of that the learner has
// never met.
export type CourseUnit = {
  readonly id: string;
  readonly name: string;
  readonly entries: number;
  readonly unlearned: number;
};

// One entry as the unit page shows it. `learned` is true once the learning pass
// has introduced the entry, which is what decides whether a drill would ask it.
export type UnitEntry = {
  readonly id: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly learned: boolean;
};

// How many of the unit's entries have been through the learning pass, which is
// what a drill of the unit would ask about.
export const learnedEntries = (unit: CourseUnit): number =>
  unit.entries - unit.unlearned;

// What can be done with a unit. Learning needs entries the learner has not met;
// drilling needs entries already met. A unit in the middle offers both, and an
// empty unit offers neither.
export const unitOffers = (
  unit: CourseUnit,
): { readonly learn: boolean; readonly drill: boolean } => ({
  learn: unit.unlearned > 0,
  drill: learnedEntries(unit) > 0,
});

// The course's own totals, summed from its units rather than queried again:
// every entry belongs to exactly one unit, so the unit list already holds them.
export const courseTotals = (
  units: ReadonlyArray<CourseUnit>,
): { readonly entries: number; readonly unlearned: number } =>
  units.reduce(
    (totals, unit) => ({
      entries: totals.entries + unit.entries,
      unlearned: totals.unlearned + unit.unlearned,
    }),
    { entries: 0, unlearned: 0 },
  );
