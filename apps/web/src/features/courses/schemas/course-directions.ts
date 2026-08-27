import { answerDirections } from '@wordhold/db/schema/directions';
import { Schema } from 'effect';

const AnswerDirectionSchema = Schema.Literal(...answerDirections);

// A course always practises at least one direction. Zero would schedule
// nothing, empty every count on the dashboard, and leave no card to answer.
// Duplicates are rejected as well, so the stored array stays a real set.
export const CourseDirections = Schema.Array(AnswerDirectionSchema).pipe(
  Schema.minItems(1),
  Schema.filter(
    (values) =>
      new Set(values).size === values.length ||
      'Jede Richtung darf nur einmal vorkommen.',
  ),
);

export type CourseDirectionsData = typeof CourseDirections.Type;

export const SetCourseDirections = Schema.Struct({
  courseId: Schema.UUID,
  directions: CourseDirections,
});

export type SetCourseDirectionsData = typeof SetCourseDirections.Type;

export const decodeSetCourseDirections =
  Schema.decodeUnknownSync(SetCourseDirections);

// What the store read out of the database, decoded rather than trusted: a
// column that ever comes back shaped differently fails here instead of
// somewhere further downstream.
export const decodeStoredDirections = Schema.decodeUnknown(CourseDirections);
