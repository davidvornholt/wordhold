import { Database } from '@wordhold/db/client';
import { Effect, Layer } from 'effect';
import { courseRepositoryLive } from './course-repository-live';
import { pageRepositoryLive } from './page-repository-live';
import { ImportRepository } from './repository';
import { storageRepositoryLive } from './storage-repository-live';
import { verifyPageLive } from './verify-page-live';

export const ImportRepositoryLive = Layer.effect(
  ImportRepository,
  Effect.gen(function* () {
    const sql = yield* Database;
    return ImportRepository.of({
      ...courseRepositoryLive(sql),
      ...pageRepositoryLive(sql),
      ...storageRepositoryLive(sql),
      verifyPage: (payload, courseId) => verifyPageLive(sql, payload, courseId),
    });
  }),
);
