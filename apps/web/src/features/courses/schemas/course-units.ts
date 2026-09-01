import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { CardState } from '@wordhold/db/schema/practice';
import type { ExampleSentence } from '../../../shared/examples/example-model';

// A unit as the course page lists it. Introduced entries participate in the
// regular learning plan. An explicit vocabulary selection may also practise
// entries before their learning pass.
export type CourseUnit = {
  readonly id: string;
  readonly name: string;
  readonly entries: number;
  readonly introduced: number;
  readonly unintroduced: number;
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
  readonly directions: ReadonlyArray<UnitDirectionProgress>;
};

export type UnitDirectionProgress = {
  readonly direction: AnswerDirection;
  readonly total: number;
  readonly introduced: number;
  readonly unintroduced: number;
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
};

export type UnitAction = {
  readonly kind: 'learn' | 'practice';
  readonly direction: AnswerDirection;
};

export type VocabularyCard = {
  readonly cardId: string;
  readonly direction: AnswerDirection;
  readonly state: CardState;
  readonly dueAt: Date | null;
  readonly introducedAt: Date | null;
  readonly failures: number;
};

export type VocabularyEntry = {
  readonly id: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: VocabularyExample | null;
  readonly introduced: boolean;
  readonly cards: ReadonlyArray<VocabularyCard>;
};

export type VocabularyExample = ExampleSentence;

export const openLearningDirections = (
  unit: CourseUnit,
): ReadonlyArray<UnitDirectionProgress> =>
  unit.directions.filter((direction) => direction.unintroduced > 0);

export const recommendedUnitAction = (unit: CourseUnit): UnitAction | null => {
  const dueDirections = unit.directions.filter(
    (direction) => direction.due > 0,
  );
  if (dueDirections.length > 0) {
    const due = dueDirections.length === 1 ? dueDirections.at(0) : undefined;
    return due === undefined
      ? null
      : { kind: 'practice', direction: due.direction };
  }
  const firstReviewDirections = unit.directions.filter(
    (direction) => direction.firstReviews > 0,
  );
  if (firstReviewDirections.length > 0) {
    const firstReview =
      firstReviewDirections.length === 1
        ? firstReviewDirections.at(0)
        : undefined;
    return firstReview === undefined
      ? null
      : { kind: 'practice', direction: firstReview.direction };
  }
  const learning = openLearningDirections(unit);
  if (learning.length === 1) {
    const onlyDirection = learning.at(0);
    return onlyDirection === undefined
      ? null
      : { kind: 'learn', direction: onlyDirection.direction };
  }
  const startedDirections = learning.filter(
    (direction) => direction.introduced > 0,
  );
  const started =
    startedDirections.length === 1 ? startedDirections.at(0) : undefined;
  return started === undefined
    ? null
    : { kind: 'learn', direction: started.direction };
};

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
