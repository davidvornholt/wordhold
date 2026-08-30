import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { CourseNotFoundError } from '../../features/import/errors/course-not-found-error';
import { UploadReadError } from '../../features/import/errors/upload-read-error';
import { UploadValidationError } from '../../features/import/errors/upload-validation-error';
import { importRuntime } from '../../features/import/runtime';
import { parseBoundedMultipartFormData } from '../../features/import/services/multipart';
import { storeUploadedPage } from '../../features/import/services/upload';
import { maximumUploadBatchSize } from '../../features/import/services/upload-queue';
import { requireSession } from '../../shared/auth/require-session';

const invalidForm = () =>
  new UploadValidationError({
    message: 'courseId und image sind erforderlich.',
    status: 400,
  });

const UploadFields = Schema.Struct({
  courseId: Schema.UUID,
  importSessionId: Schema.UUID,
  importPosition: Schema.NumberFromString.pipe(
    Schema.int(),
    Schema.between(0, maximumUploadBatchSize - 1),
  ),
});

const decodeUploadFields = Schema.decodeUnknownOption(UploadFields);

const uploadResponse = (request: Request) =>
  Effect.gen(function* () {
    yield* requireSession(request.headers);
    const form = yield* parseBoundedMultipartFormData(request);
    const courseId = form.get('courseId');
    const importSessionId = form.get('importSessionId');
    const importPosition = form.get('importPosition');
    const image = form.get('image');
    const fields = decodeUploadFields({
      courseId,
      importSessionId,
      importPosition,
    });
    if (Option.isNone(fields) || !(image instanceof File)) {
      return yield* invalidForm();
    }
    return yield* storeUploadedPage(
      fields.value.courseId,
      fields.value.importSessionId,
      fields.value.importPosition,
      image,
    );
  }).pipe(
    Effect.match({
      onFailure: (error) => {
        if (error instanceof UploadValidationError) {
          return Response.json(
            { error: error.message },
            { status: error.status },
          );
        }
        if (error instanceof CourseNotFoundError) {
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
