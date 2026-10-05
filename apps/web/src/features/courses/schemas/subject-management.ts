import { Schema } from 'effect';
import { listCourseKinds } from '../../../shared/directions';
import { Uuid } from '../../../shared/validate/uuid';

export const maximumSubjectNameLength = 80;

// A subject or collection is named by the learner, such as "Chemie" or
// "Bibelverse".
export const SubjectName = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumSubjectNameLength),
);

export const CreateSubject = Schema.Struct({
  name: SubjectName,
  kind: Schema.Literals(listCourseKinds),
});
export type CreateSubjectData = typeof CreateSubject.Type;

export const RenameSubject = Schema.Struct({
  courseId: Uuid,
  name: SubjectName,
});
export type RenameSubjectData = typeof RenameSubject.Type;

export const decodeCreateSubject = Schema.decodeUnknownSync(CreateSubject);
export const decodeRenameSubject = Schema.decodeUnknownSync(RenameSubject);
