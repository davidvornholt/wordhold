import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { CardState } from '@wordhold/db/schema/practice';

// A unit as the course page lists it. The two counts are what every screen
// about a unit needs: how much is in it, and how much of that the learner has
// never met.
export type CourseUnit = {
  readonly id: string;
  readonly name: string;
  readonly entries: number;
  readonly unintroduced: number;
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
};

export type VocabularyCard = {
  readonly cardId: string;
  readonly direction: AnswerDirection;
  readonly state: CardState;
  readonly dueAt: Date | null;
  readonly introducedAt: Date | null;
  readonly lastReviewedAt: Date | null;
  readonly failures: number;
  readonly recentReviews: ReadonlyArray<{
    readonly reviewedAt: string;
    readonly rating: number;
  }>;
};

export type VocabularyEntry = {
  readonly id: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly introduced: boolean;
  readonly cards: ReadonlyArray<VocabularyCard>;
};

// How many of the unit's entries have been through the learning pass, which is
// what a free practice session for the unit would ask about.
export const introducedEntries = (unit: CourseUnit): number =>
  unit.entries - unit.unintroduced;

// What can be done with a unit. Learning needs entries the learner has not met;
// Free practice needs entries already met. A unit in the middle offers both,
// and an empty unit offers neither.
export const unitOffers = (
  unit: CourseUnit,
): { readonly learn: boolean; readonly practice: boolean } => ({
  learn: unit.unintroduced > 0,
  practice: introducedEntries(unit) > 0,
});

// The course's own totals, summed from its units rather than queried again:
// every entry belongs to exactly one unit, so the unit list already holds them.
export const courseTotals = (
  units: ReadonlyArray<CourseUnit>,
): { readonly entries: number; readonly unintroduced: number } =>
  units.reduce(
    (totals, unit) => ({
      entries: totals.entries + unit.entries,
      unintroduced: totals.unintroduced + unit.unintroduced,
    }),
    { entries: 0, unintroduced: 0 },
  );
