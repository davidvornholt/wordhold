import { describe, expect, it } from 'bun:test';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { Effect, Layer, Result } from 'effect';
import { Storage } from '../../../shared/storage/server';
import {
  CourseBookNotFoundError,
  CourseUnitNotFoundError,
} from '../errors/courses-errors';
import {
  decodeDeleteEntries,
  decodeMoveEntries,
} from '../schemas/entry-changes';
import { VocabularyEntryService } from './vocabulary-entry-service';
import {
  type MoveEntriesResult,
  VocabularyEntryStore,
} from './vocabulary-entry-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bookId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const unitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// A move only asks the store.
const unreached = () => Effect.die('moving uses nothing but the store');

const moveTo = (targetUnitId: string | null, stored: MoveEntriesResult) =>
  Effect.runPromise(
    Effect.flatMap(VocabularyEntryService, (service) =>
      service.move({
        courseId,
        entryIds: [entryId],
        bookId,
        unitId: targetUnitId,
      }),
    ).pipe(
      Effect.provide(
        VocabularyEntryService.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(VocabularyEntryStore, {
                readCourse: unreached,
                readPlace: unreached,
                create: unreached,
                update: unreached,
                remove: unreached,
                move: () => Effect.succeed(stored),
                storeAudio: unreached,
              }),
              Layer.succeed(
                SentenceGen,
                SentenceGen.of({
                  generate: unreached,
                  translate: unreached,
                  translateWord: unreached,
                }),
              ),
              Layer.succeed(Storage, {
                read: unreached,
                reconcile: unreached,
                remove: unreached,
                write: unreached,
                writeIfAbsent: unreached,
              }),
              Layer.succeed(Tts, Tts.of({ synthesize: unreached })),
            ),
          ),
        ),
      ),
      Effect.result,
    ),
  );

describe('VocabularyEntryService move', () => {
  it('succeeds with how many words moved', async () => {
    const moved = await moveTo(unitId, { kind: 'moved', moved: 2 });
    expect(Result.getOrNull(moved)).toBe(2);
  });

  it('names the place that is missing', async () => {
    const toUnit = await moveTo(unitId, { kind: 'place-missing' });
    const toBook = await moveTo(null, { kind: 'place-missing' });
    expect(Result.isFailure(toUnit) ? toUnit.failure : null).toBeInstanceOf(
      CourseUnitNotFoundError,
    );
    expect(Result.isFailure(toBook) ? toBook.failure : null).toBeInstanceOf(
      CourseBookNotFoundError,
    );
  });
});

describe('selection changes', () => {
  it('need at least one entry', () => {
    expect(() => decodeDeleteEntries({ courseId, entryIds: [] })).toThrow();
    expect(() =>
      decodeMoveEntries({ courseId, entryIds: [], bookId, unitId: null }),
    ).toThrow();
    expect(
      decodeDeleteEntries({ courseId, entryIds: [entryId] }).entryIds,
    ).toEqual([entryId]);
  });
});
