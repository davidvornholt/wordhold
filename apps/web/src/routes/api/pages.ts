import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { CourseNotFoundError } from '../../features/import/errors/course-not-found-error';
import { UploadReadError } from '../../features/import/errors/upload-read-error';
import { UploadValidationError } from '../../features/import/errors/upload-validation-error';
import { importRuntime } from '../../features/import/runtime';
import { parseBoundedMultipartFormData } from '../../features/import/services/multipart';
import { createUploadedPage } from '../../features/import/services/upload';
import { requireSession } from '../../shared/auth/require-session';

const invalidForm = () =>
  new UploadValidationError({
    message: 'courseId und image sind erforderlich.',
    status: 400,
  });

const uploadResponse = (request: Request) =>
  Effect.gen(function* () {
    yield* requireSession(request.headers);
    const form = yield* parseBoundedMultipartFormData(request);
    const courseId = form.get('courseId');
    const image = form.get('image');
    if (typeof courseId !== 'string' || !(image instanceof File)) {
      return yield* invalidForm();
    }
    return yield* createUploadedPage(courseId, image);
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
