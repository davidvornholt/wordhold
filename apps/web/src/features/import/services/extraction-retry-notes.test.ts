import { describe, expect, it } from 'bun:test';
import { Extraction } from '@wordhold/ai/extraction';
import type { QuarterTurn } from '@wordhold/ai/extraction/page-image';
import { NotesExtraction } from '@wordhold/ai/notes';
import type { NotesPageData } from '@wordhold/ai/notes/schema';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportInvariantError } from '../errors/import-invariant-error';
import { retryPendingExtraction } from './extraction-retry';
import { ImportRepository, type PageReading } from './repository';
import { makeImportRepository, makeStorage } from './test-services';

const onePixelPng = Uint8Array.fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

const notes: NotesPageData = {
  textTop: 'up',
  terms: [
    {
      term: 'Alkan',
      definition: 'Organische Verbindung mit der Summenformel CnH2n+2',
      confidence: 0.95,
    },
  ],
};

// A vocabulary page never reaches the vocabulary reader here.
const noVocabulary = Extraction.of({
  extract: () => Effect.die(new Error('Notes were read as vocabulary.')),
});

const readNotes = async (options: {
  readonly kind: 'terms' | 'texts';
  readonly photo: Uint8Array<ArrayBuffer>;
  readonly turned: QuarterTurn;
}) => {
  const written: Array<{ path: string; bytes: Uint8Array }> = [];
  const saved: Array<PageReading> = [];
  let reads = 0;
  const base = makeImportRepository();
  const repository = makeImportRepository({
    loadPendingExtraction: () =>
      Effect.succeed({
        imagePath: 'pages/notes.png',
        kind: options.kind,
        language: 'de',
      }),
    saveExtractionIfPending: (pageId, reading) => {
      saved.push(reading);
      return base.saveExtractionIfPending(pageId, reading);
    },
  });
  const result = await Effect.runPromise(
    Effect.result(
      retryPendingExtraction('page').pipe(
        Effect.provideService(ImportRepository, repository),
        Effect.provideService(
          Storage,
          makeStorage({
            read: () => Effect.succeed(options.photo),
            write: (path, bytes) =>
              Effect.sync(() => {
                written.push({ path, bytes });
              }),
          }),
        ),
        Effect.provideService(Extraction, noVocabulary),
        Effect.provideService(
          NotesExtraction,
          NotesExtraction.of({
            extract: () =>
              Effect.sync(() => {
                reads += 1;
                return {
                  notes,
                  modelId: 'test-model',
                  turned: options.turned,
                };
              }),
          }),
        ),
        Effect.provide(untrackedAiUsage),
      ),
    ),
  );
  return { reads, result, saved, written };
};

describe('retryPendingExtraction for a subject', () => {
  it('stores a sideways photo upright and keeps the reading', async () => {
    // Storage hands out bytes on their own buffer.
    const photo = new Uint8Array(
      await new globalThis.Bun.Image(onePixelPng)
        .resize(400, 300)
        .png()
        .bytes(),
    );

    const { result, saved, written } = await readNotes({
      kind: 'terms',
      photo,
      turned: 270,
    });

    expect(result._tag).toBe('Success');
    expect(saved).toEqual([{ notes, modelId: 'test-model' }]);
    expect(written.map((write) => write.path)).toEqual(['pages/notes.png']);
    const [stored] = written;
    expect(
      stored === undefined
        ? undefined
        : await new globalThis.Bun.Image(stored.bytes).metadata(),
    ).toMatchObject({ width: 300, height: 400, format: 'png' });
  });

  it('leaves an upright photo as it was stored', async () => {
    const { saved, written } = await readNotes({
      kind: 'terms',
      photo: onePixelPng,
      turned: 0,
    });

    expect(saved).toEqual([{ notes, modelId: 'test-model' }]);
    expect(written).toEqual([]);
  });

  it('reads no page of a collection of texts', async () => {
    const { reads, result, saved } = await readNotes({
      kind: 'texts',
      photo: onePixelPng,
      turned: 0,
    });

    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: expect.any(ImportInvariantError),
    });
    expect(reads).toBe(0);
    expect(saved).toEqual([]);
  });
});
