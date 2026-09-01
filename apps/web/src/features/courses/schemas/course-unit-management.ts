import { maximumUnitNameLength } from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';

const UnitName = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumUnitNameLength),
);

export const CreateCourseUnit = Schema.Struct({
  courseId: Schema.UUID,
  name: UnitName,
});

export type CreateCourseUnitData = typeof CreateCourseUnit.Type;

const OrderedUnitIds = Schema.Array(Schema.UUID).pipe(
  Schema.filter(
    (unitIds) =>
      new Set(unitIds).size === unitIds.length ||
      'Jede Einheit darf nur einmal in der Reihenfolge vorkommen.',
  ),
);

export const ReorderCourseUnits = Schema.Struct({
  courseId: Schema.UUID,
  expectedUnitIds: OrderedUnitIds,
  unitIds: OrderedUnitIds,
});

export type ReorderCourseUnitsData = typeof ReorderCourseUnits.Type;

export const decodeCreateCourseUnit =
  Schema.decodeUnknownSync(CreateCourseUnit);

export const decodeReorderCourseUnits =
  Schema.decodeUnknownSync(ReorderCourseUnits);
