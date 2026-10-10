import { answerDirections } from '@wordhold/db/schema/directions';
import { Schema } from 'effect';
import { isRelationDirection } from '../../../shared/directions';
import { Uuid } from '../../../shared/validate/uuid';

const AnswerDirectionSchema = Schema.Literals(answerDirections);

// The directions a course practises. A course always keeps at least one
// translation direction. Zero would schedule nothing, empty every count on
// the dashboard, and leave no card to answer. Synonyms and antonyms are one
// setting of the course, so they are switched on and off together.
// Duplicates are rejected as well, so the stored array stays a real set.
export const CourseDirections = Schema.Array(AnswerDirectionSchema).check(
  Schema.makeFilter(
    (values) =>
      values.some((value) => !isRelationDirection(value)) ||
      'Eine Übersetzungsrichtung bleibt immer an.',
  ),
  Schema.makeFilter(
    (values) =>
      values.includes('to_synonym') === values.includes('to_antonym') ||
      'Synonyme und Gegenteile werden nur zusammen ein- oder ausgeschaltet.',
  ),
  Schema.makeFilter(
    (values) =>
      new Set(values).size === values.length ||
      'Jede Richtung darf nur einmal vorkommen.',
  ),
);

export type CourseDirectionsData = typeof CourseDirections.Type;

export const SetCourseDirections = Schema.Struct({
  courseId: Uuid,
  directions: CourseDirections,
});

export type SetCourseDirectionsData = typeof SetCourseDirections.Type;

export const decodeSetCourseDirections =
  Schema.decodeUnknownSync(SetCourseDirections);

// What the store read out of the database, decoded rather than trusted: a
// column that ever comes back shaped differently fails here instead of
// somewhere further downstream.
export const decodeStoredDirections =
  Schema.decodeUnknownEffect(CourseDirections);
