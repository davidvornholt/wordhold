import { Effect } from 'effect';
import { imageDimensionsFromData } from 'image-dimensions';
import { persistFileReference } from '../../../shared/storage/consistency';
import { pageImageRelativePath, Storage } from '../../../shared/storage/server';
import { CourseNotFoundError } from '../errors/course-not-found-error';
import { UploadReadError } from '../errors/upload-read-error';
import { UploadValidationError } from '../errors/upload-validation-error';
import { reconcileStoredFiles } from './reconcile-stored-files';
import { ImportRepository } from './repository';

const bytesPerKibibyte = 1024;
const kibibytesPerMebibyte = 1024;
const maximumImageMebibytes = 12;
const multipartOverheadKibibytes = 64;
const badRequestStatus = 400;
const contentTooLargeStatus = 413;
const unsupportedMediaTypeStatus = 415;

export const maximumImageBytes =
  maximumImageMebibytes * kibibytesPerMebibyte * bytesPerKibibyte;
export const maximumMultipartBytes =
  maximumImageBytes + multipartOverheadKibibytes * bytesPerKibibyte;
export const maximumImageWidth = 12_000;
export const maximumImageHeight = 12_000;
export const maximumImagePixels = 40_000_000;

const formatDetails = {
  jpeg: { extension: 'jpg', mediaType: 'image/jpeg' },
  png: { extension: 'png', mediaType: 'image/png' },
  webp: { extension: 'webp', mediaType: 'image/webp' },
} as const;

export type ValidatedPageImage = {
  readonly bytes: Uint8Array;
  readonly extension: 'jpg' | 'png' | 'webp';
  readonly mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly width: number;
  readonly height: number;
};

const invalidUpload = (message: string, status = badRequestStatus) =>
  new UploadValidationError({ message, status });

export const validatePageImage = (
  image: File,
): Effect.Effect<ValidatedPageImage, UploadValidationError | UploadReadError> =>
  Effect.gen(function* () {
    if (image.size === 0) {
      return yield* invalidUpload('Das Bild ist leer.');
    }
    if (image.size > maximumImageBytes) {
      return yield* invalidUpload(
        'Das Bild ist größer als 12 MiB.',
        contentTooLargeStatus,
      );
    }
    const bytes = yield* Effect.tryPromise({
      try: async () => new Uint8Array(await image.arrayBuffer()),
      catch: (cause) =>
        new UploadReadError({
          cause,
          message: 'Das Bild konnte nicht gelesen werden.',
        }),
    });
    if (
      bytes.byteLength !== image.size ||
      bytes.byteLength > maximumImageBytes
    ) {
      return yield* invalidUpload('Ungültige Upload-Größe.');
    }
    const dimensions = yield* Effect.try({
      try: () => imageDimensionsFromData(bytes),
      catch: () =>
        invalidUpload(
          'Das Bild muss eine JPEG-, PNG- oder WebP-Datei sein.',
          unsupportedMediaTypeStatus,
        ),
    });
    if (dimensions === undefined || !(dimensions.type in formatDetails)) {
      return yield* invalidUpload(
        'Das Bild muss eine JPEG-, PNG- oder WebP-Datei sein.',
        unsupportedMediaTypeStatus,
      );
    }
    if (
      dimensions.width > maximumImageWidth ||
      dimensions.height > maximumImageHeight ||
      dimensions.width * dimensions.height > maximumImagePixels
    ) {
      return yield* invalidUpload(
        'Das Bild überschreitet die erlaubten Abmessungen.',
        contentTooLargeStatus,
      );
    }
    const details =
      formatDetails[dimensions.type as keyof typeof formatDetails];
    return {
      bytes,
      width: dimensions.width,
      height: dimensions.height,
      ...details,
    };
  });

export const storeUploadedPage = (input: {
  readonly courseId: string;
  readonly importSessionId: string;
  readonly importPosition: number;
  readonly importExpectedCount: number;
  readonly pageId: string;
  readonly image: File;
}) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const storage = yield* Storage;
    const validated = yield* validatePageImage(input.image);
    const course = yield* repository.getCourse(input.courseId);
    if (course === undefined) {
      return yield* new CourseNotFoundError({
        message: 'Kurs nicht gefunden.',
      });
    }
    yield* reconcileStoredFiles;
    const existingPage = yield* repository.getPageUpload(input.pageId);
    if (
      existingPage !== undefined &&
      (existingPage.courseId !== input.courseId ||
        existingPage.importSessionId !== input.importSessionId ||
        existingPage.importPosition !== input.importPosition ||
        existingPage.importExpectedCount !== input.importExpectedCount)
    ) {
      return yield* Effect.fail(
        new Error('The upload page identity does not match.'),
      );
    }
    const imagePath =
      existingPage?.imagePath ??
      pageImageRelativePath(
        input.pageId,
        validated.extension,
        crypto.randomUUID(),
      );
    yield* persistFileReference({
      write:
        existingPage === undefined
          ? storage.write(imagePath, validated.bytes)
          : storage.writeIfAbsent(imagePath, validated.bytes),
      persistReference: repository.insertPage({
        id: input.pageId,
        courseId: input.courseId,
        importSessionId: input.importSessionId,
        importPosition: input.importPosition,
        importExpectedCount: input.importExpectedCount,
        imagePath,
      }),
      remove:
        existingPage === undefined ? storage.remove(imagePath) : Effect.void,
    });

    return { pageId: input.pageId };
  });
