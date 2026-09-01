import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { MediaDatabaseError } from './media-database-error';
import { MediaNotFoundError } from './media-not-found-error';
import { Storage } from './server';

export type MediaRepositoryShape = {
  readonly audioPath: (
    entryId: string,
  ) => Effect.Effect<string | undefined, MediaDatabaseError>;
  readonly pageImagePath: (
    pageId: string,
  ) => Effect.Effect<string | undefined, MediaDatabaseError>;
};

export class MediaRepository extends Context.Tag(
  '@wordhold/web/storage/MediaRepository',
)<MediaRepository, MediaRepositoryShape>() {}

export const MediaRepositoryLive = Layer.effect(
  MediaRepository,
  Effect.gen(function* () {
    const sql = yield* Database;
    const mapDatabaseError = (cause: unknown) =>
      new MediaDatabaseError({
        cause,
        message: 'Die Mediendatei konnte nicht nachgeschlagen werden.',
      });
    return MediaRepository.of({
      audioPath: (entryId) =>
        sql<{
          path: string;
          voice: string;
          targetText: string;
          language: LanguageCode;
        }>`
          select entry_audio.path,
            entry_audio.voice,
            entries.target_text as "targetText",
            courses.target_language as language
          from entry_audio
          inner join entries on entries.id = entry_audio.entry_id
          inner join courses on courses.id = entries.course_id
          where entry_audio.entry_id = ${entryId}
        `.pipe(
          Effect.map(
            (rows) =>
              rows.find(
                (row) =>
                  row.voice === ttsAudioProfile(row.targetText, row.language),
              )?.path,
          ),
          Effect.mapError(mapDatabaseError),
        ),
      pageImagePath: (pageId) =>
        sql<{
          path: string;
        }>`select image_path as path from pages where id = ${pageId} limit 1`.pipe(
          Effect.map((rows) => rows[0]?.path),
          Effect.mapError(mapDatabaseError),
        ),
    });
  }),
);

const loadMedia = (
  findPath: (
    repository: MediaRepositoryShape,
  ) => Effect.Effect<string | undefined, MediaDatabaseError>,
) =>
  Effect.gen(function* () {
    const repository = yield* MediaRepository;
    const storage = yield* Storage;
    const path = yield* findPath(repository);
    if (path === undefined) {
      return yield* new MediaNotFoundError({ message: 'Nicht gefunden' });
    }
    return { path, bytes: yield* storage.read(path) };
  });

export const loadEntryAudio = (entryId: string) =>
  loadMedia((repository) => repository.audioPath(entryId));

export const loadPageImage = (pageId: string) =>
  loadMedia((repository) => repository.pageImagePath(pageId));
