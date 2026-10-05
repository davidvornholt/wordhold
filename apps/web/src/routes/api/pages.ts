import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { CourseNotFoundError } from '../../features/import/errors/course-not-found-error';
import { UploadReadError } from '../../features/import/errors/upload-read-error';
import { UploadValidationError } from '../../features/import/errors/upload-validation-error';
import { importRuntime } from '../../features/import/runtime';
import { parseBoundedMultipartFormData } from '../../features/import/services/multipart';
import { storeUploadedPage } from '../../features/import/services/upload';
import { maximumUploadBatchSize } from '../../features/import/services/upload-queue';
import { assertOwned, NotOwnedError } from '../../shared/auth/ownership';
import { requireMember } from '../../shared/auth/require-member';
import { Uuid } from '../../shared/validate/uuid';

const invalidForm = () =>
  new UploadValidationError({
    message:
      'courseId, pageId, importSessionId, importPosition, importExpectedCount und image sind erforderlich.',
    status: 400,
  });

const UploadFields = Schema.Struct({
  courseId: Uuid,
  importSessionId: Uuid,
  pageId: Uuid,
  importPosition: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: maximumUploadBatchSize - 1 }),
  ),
  importExpectedCount: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: maximumUploadBatchSize }),
  ),
}).check(
  Schema.makeFilter(
    (fields) =>
      fields.importPosition < fields.importExpectedCount ||
      'Die Seitenposition muss innerhalb der erwarteten Stapelgröße liegen.',
  ),
);

const decodeUploadFields = Schema.decodeUnknownOption(UploadFields);

const uploadResponse = (request: Request) =>
  Effect.gen(function* () {
    // Checked before the body is read, so a stranger's upload is not parsed.
    const member = yield* requireMember(request.headers);
    const form = yield* parseBoundedMultipartFormData(request);
    const courseId = form.get('courseId');
    const importSessionId = form.get('importSessionId');
    const pageId = form.get('pageId');
    const importPosition = form.get('importPosition');
    const importExpectedCount = form.get('importExpectedCount');
    const image = form.get('image');
    const fields = decodeUploadFields({
      courseId,
      importSessionId,
      pageId,
      importPosition,
      importExpectedCount,
    });
    if (Option.isNone(fields) || !(image instanceof File)) {
      return yield* invalidForm();
    }
    // An existing page or import session must match this course, so owning
    // the course covers them as well.
    yield* assertOwned(member.userId, { courses: [fields.value.courseId] });
    return yield* storeUploadedPage({
      courseId: fields.value.courseId,
      importSessionId: fields.value.importSessionId,
      importPosition: fields.value.importPosition,
      importExpectedCount: fields.value.importExpectedCount,
      pageId: fields.value.pageId,
      image,
    });
  }).pipe(
    Effect.match({
      onFailure: (error) => {
        if (error instanceof UploadValidationError) {
          return Response.json(
            { error: error.message },
            { status: error.status },
          );
        }
        if (
          error instanceof CourseNotFoundError ||
          error instanceof NotOwnedError
        ) {
          return Response.json({ error: error.message }, { status: 404 });
        }
        if (error instanceof UploadReadError) {
          return Response.json({ error: error.message }, { status: 400 });
        }
        throw error;
      },
      onSuccess: (result) => Response.json(result),
    }),
  );

export const Route = createFileRoute('/api/pages')({
  server: {
    handlers: {
      POST: ({ request }) => importRuntime.runPromise(uploadResponse(request)),
    },
  },
});
