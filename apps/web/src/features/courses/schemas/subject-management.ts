import { Schema } from 'effect';
import { listCourseKinds } from '../../../shared/directions';

export const maximumSubjectNameLength = 80;

// A subject or collection is named by the learner, such as "Chemie" or
// "Bibelverse".
export const SubjectName = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumSubjectNameLength),
);

export const CreateSubject = Schema.Struct({
  name: SubjectName,
  kind: Schema.Literal(...listCourseKinds),
});
export type CreateSubjectData = typeof CreateSubject.Type;

export const RenameSubject = Schema.Struct({
  courseId: Schema.UUID,
  name: SubjectName,
});
export type RenameSubjectData = typeof RenameSubject.Type;

export const decodeCreateSubject = Schema.decodeUnknownSync(CreateSubject);
export const decodeRenameSubject = Schema.decodeUnknownSync(RenameSubject);
