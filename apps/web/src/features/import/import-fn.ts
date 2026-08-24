import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { Effect } from 'effect';
import { requireSession } from '../../shared/auth/require-session';
import { importRuntime } from './runtime';
import { decodeImportPayload } from './schemas/import-payload';
import { serializableAudioReport } from './services/audio-generation';
import { importVerifiedPage } from './services/import-page';

export const importPage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeImportPayload(input))
  .handler(({ data }) =>
    importRuntime.runPromise(
      Effect.zipRight(
        requireSession(getRequest().headers),
        importVerifiedPage(data).pipe(
          Effect.map((result) => ({
            ...result,
            audio: serializableAudioReport(result.audio),
          })),
        ),
      ),
    ),
  );
