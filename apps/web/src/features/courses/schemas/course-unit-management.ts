import { maximumUnitNameLength } from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { BookName } from '../../../shared/vocabulary/book-name';

const UnitName = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumUnitNameLength),
);

export const CreateCourseBook = Schema.Struct({
  courseId: Uuid,
  name: BookName,
});

export type CreateCourseBookData = typeof CreateCourseBook.Type;

export const RenameCourseBook = Schema.Struct({
  courseId: Uuid,
  bookId: Uuid,
  name: BookName,
});

export type RenameCourseBookData = typeof RenameCourseBook.Type;

export const CreateCourseUnit = Schema.Struct({
  courseId: Uuid,
  bookId: Uuid,
  name: UnitName,
});

export type CreateCourseUnitData = typeof CreateCourseUnit.Type;

const OrderedUnitIds = Schema.Array(Uuid).check(
  Schema.makeFilter(
    (unitIds) =>
      new Set(unitIds).size === unitIds.length ||
      'Jede Einheit darf nur einmal in der Reihenfolge vorkommen.',
  ),
);

// Units are ordered within their book, so a reorder names the book it
// rearranges and lists only that book's units.
export const ReorderCourseUnits = Schema.Struct({
  courseId: Uuid,
  bookId: Uuid,
  expectedUnitIds: OrderedUnitIds,
  unitIds: OrderedUnitIds,
});

export type ReorderCourseUnitsData = typeof ReorderCourseUnits.Type;

export const decodeCreateCourseBook =
  Schema.decodeUnknownSync(CreateCourseBook);

export const decodeRenameCourseBook =
  Schema.decodeUnknownSync(RenameCourseBook);

export const decodeCreateCourseUnit =
  Schema.decodeUnknownSync(CreateCourseUnit);

export const decodeReorderCourseUnits =
  Schema.decodeUnknownSync(ReorderCourseUnits);
