import type { ExtractionResult } from '@wordhold/ai/extraction';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { imageDimensionsFromData } from 'image-dimensions';
import { persistFileReference } from '../storage/consistency';
import { pageImageRelativePath } from '../storage/server';

const bytesPerKibibyte = 1024;
const kibibytesPerMebibyte = 1024;
const maximumImageMebibytes = 12;
const multipartOverheadKibibytes = 64;
const badRequestStatus = 400;
const contentTooLargeStatus = 413;
const unsupportedMediaTypeStatus = 415;
const notFoundStatus = 404;

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

export class UploadValidationError extends Error {
  readonly name = 'UploadValidationError';
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ValidatedPageImage = {
  readonly bytes: Uint8Array;
  readonly extension: 'jpg' | 'png' | 'webp';
  readonly mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly width: number;
  readonly height: number;
};

export const validatePageImage = async (
  image: File,
): Promise<ValidatedPageImage> => {
  if (image.size === 0) {
    throw new UploadValidationError('Das Bild ist leer.', badRequestStatus);
  }
  if (image.size > maximumImageBytes) {
    throw new UploadValidationError(
      'Das Bild ist größer als 12 MiB.',
      contentTooLargeStatus,
    );
  }
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (bytes.byteLength !== image.size || bytes.byteLength > maximumImageBytes) {
    throw new UploadValidationError(
      'Ungültige Upload-Größe.',
      badRequestStatus,
    );
  }
  const dimensions = imageDimensionsFromData(bytes);
  if (dimensions === undefined || !(dimensions.type in formatDetails)) {
    throw new UploadValidationError(
      'Das Bild muss eine JPEG-, PNG- oder WebP-Datei sein.',
      unsupportedMediaTypeStatus,
    );
  }
  if (
    dimensions.width > maximumImageWidth ||
    dimensions.height > maximumImageHeight ||
    dimensions.width * dimensions.height > maximumImagePixels
  ) {
    throw new UploadValidationError(
      'Das Bild überschreitet die erlaubten Abmessungen.',
      contentTooLargeStatus,
    );
  }
  const details = formatDetails[dimensions.type as keyof typeof formatDetails];
  return {
    bytes,
    width: dimensions.width,
    height: dimensions.height,
    ...details,
  };
};

type UploadCourse = {
  readonly id: string;
  readonly targetLanguage: LanguageCode;
};

type CreateUploadedPageDependencies = {
  readonly findCourse: (courseId: string) => Promise<UploadCourse | undefined>;
  readonly newPageId: () => string;
  readonly reconcile: () => Promise<unknown>;
  readonly writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  readonly removeFile: (path: string) => Promise<void>;
  readonly insertPage: (input: {
    readonly id: string;
    readonly courseId: string;
    readonly imagePath: string;
  }) => Promise<void>;
  readonly extract: (input: {
    readonly imageBase64: string;
    readonly mediaType: string;
    readonly language: LanguageCode;
  }) => Promise<ExtractionResult>;
  readonly updateExtraction: (
    pageId: string,
    result: ExtractionResult,
  ) => Promise<boolean>;
  readonly toBase64: (bytes: Uint8Array) => string;
};

export const createUploadedPage = async (
  courseId: string,
  image: File,
  dependencies: CreateUploadedPageDependencies,
): Promise<{
  readonly pageId: string;
  readonly extractionError: string | null;
}> => {
  const validated = await validatePageImage(image);
  const course = await dependencies.findCourse(courseId);
  if (course === undefined) {
    throw new UploadValidationError('Kurs nicht gefunden.', notFoundStatus);
  }
  await dependencies.reconcile();
  const pageId = dependencies.newPageId();
  const imagePath = pageImageRelativePath(pageId, validated.extension);
  await persistFileReference({
    write: () => dependencies.writeFile(imagePath, validated.bytes),
    persistReference: () =>
      dependencies.insertPage({ id: pageId, courseId, imagePath }),
    remove: () => dependencies.removeFile(imagePath),
  });

  let extractionError: string | null = null;
  try {
    const result = await dependencies.extract({
      imageBase64: dependencies.toBase64(validated.bytes),
      mediaType: validated.mediaType,
      language: course.targetLanguage,
    });
    if (!(await dependencies.updateExtraction(pageId, result))) {
      throw new Error(
        'Die Seite wurde während des Auslesens bereits importiert.',
      );
    }
  } catch (error) {
    extractionError = error instanceof Error ? error.message : String(error);
  }
  return { pageId, extractionError };
};
