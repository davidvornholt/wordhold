import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type {
  CourseUnit,
  UnitDirectionProgress,
} from '../schemas/course-units';

type DirectionColumns = {
  readonly total: number;
  readonly introduced: number;
  readonly unintroduced: number;
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
};

export type CourseUnitRow = Omit<CourseUnit, 'directions'> & {
  readonly toTargetEnabled: boolean;
  readonly toTargetTotal: number;
  readonly toTargetIntroduced: number;
  readonly toTargetUnintroduced: number;
  readonly toTargetDue: number;
  readonly toTargetFirstReviews: number;
  readonly toTargetNextDueAt: Date | null;
  readonly toNativeEnabled: boolean;
  readonly toNativeTotal: number;
  readonly toNativeIntroduced: number;
  readonly toNativeUnintroduced: number;
  readonly toNativeDue: number;
  readonly toNativeFirstReviews: number;
  readonly toNativeNextDueAt: Date | null;
};

const directionProgress = (
  direction: AnswerDirection,
  columns: DirectionColumns,
): UnitDirectionProgress => ({
  direction,
  total: columns.total,
  introduced: columns.introduced,
  unintroduced: columns.unintroduced,
  due: columns.due,
  firstReviews: columns.firstReviews,
  nextDueAt: columns.nextDueAt,
});

export const courseUnitFromRow = (row: CourseUnitRow): CourseUnit => {
  const {
    toTargetEnabled,
    toTargetTotal,
    toTargetIntroduced,
    toTargetUnintroduced,
    toTargetDue,
    toTargetFirstReviews,
    toTargetNextDueAt,
    toNativeEnabled,
    toNativeTotal,
    toNativeIntroduced,
    toNativeUnintroduced,
    toNativeDue,
    toNativeFirstReviews,
    toNativeNextDueAt,
    ...unit
  } = row;
  const directions: Array<UnitDirectionProgress> = [];
  if (toTargetEnabled) {
    directions.push(
      directionProgress('to_target', {
        total: toTargetTotal,
        introduced: toTargetIntroduced,
        unintroduced: toTargetUnintroduced,
        due: toTargetDue,
        firstReviews: toTargetFirstReviews,
        nextDueAt: toTargetNextDueAt,
      }),
    );
  }
  if (toNativeEnabled) {
    directions.push(
      directionProgress('to_native', {
        total: toNativeTotal,
        introduced: toNativeIntroduced,
        unintroduced: toNativeUnintroduced,
        due: toNativeDue,
        firstReviews: toNativeFirstReviews,
        nextDueAt: toNativeNextDueAt,
      }),
    );
  }
  return { ...unit, directions };
};
