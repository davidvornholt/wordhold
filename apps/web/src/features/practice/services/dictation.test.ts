import { describe, expect, it } from 'bun:test';
import { Stt } from '@wordhold/ai/stt';
import { AiUsage } from '@wordhold/ai/usage';
import { Effect, Layer } from 'effect';
import { UsageLedger } from '../../../shared/ai/usage-ledger';
import { dictationContentType } from '../schemas/dictation';
import { readDictation, transcribeDictation } from './dictation';

const recording = (bytes: number, contentType = dictationContentType) =>
  new Request('http://localhost/api/dictations', {
    method: 'POST',
    body: new Uint8Array(bytes),
    headers: { 'content-type': contentType, 'content-length': String(bytes) },
  });

const read = (request: Request) =>
  Effect.runPromise(Effect.result(readDictation(request)));

describe('readDictation', () => {
  it('reads a recording in the agreed format', async () => {
    const result = await read(recording(3200));
    expect(result._tag === 'Success' ? result.success.byteLength : null).toBe(
      3200,
    );
  });

  it('refuses another format, a cut-off sample and an overlong recording', async () => {
    expect(await read(recording(3200, 'audio/webm'))).toMatchObject({
      _tag: 'Failure',
      failure: { status: 415 },
    });
    expect(await read(recording(3201))).toMatchObject({
      _tag: 'Failure',
      failure: { message: 'Die Aufnahme ist unvollständig.', status: 400 },
    });
    expect(await read(recording(16_000 * 2 * 302))).toMatchObject({
      _tag: 'Failure',
      failure: {
        message: 'Die Aufnahme ist länger als 5 Minuten.',
        status: 413,
      },
    });
  });
});

describe('transcribeDictation', () => {
  it('bills the recognition to the person who spoke', async () => {
    const billed: Array<string> = [];
    const usage = AiUsage.of({
      start: () => Effect.succeed({ settle: () => Effect.void }),
    });
    const transcript = await Effect.runPromise(
      transcribeDictation('anna', new Uint8Array(3200)).pipe(
        Effect.provideService(
          Stt,
          Stt.of({
            transcribe: () =>
              Effect.flatMap(AiUsage, (current) =>
                current.start({
                  operation: 'transcription',
                  provider: 'transcribe',
                  model: 'standard',
                }),
              ).pipe(
                Effect.orDie,
                Effect.as({ transcript: 'Seid fröhlich in Hoffnung' }),
              ),
          }),
        ),
        Effect.provide(
          Layer.succeed(UsageLedger, {
            forPerson: (userId) => {
              billed.push(userId);
              return usage;
            },
          }),
        ),
      ),
    );
    expect(transcript).toBe('Seid fröhlich in Hoffnung');
    expect(billed).toEqual(['anna']);
  });
});
