import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { Effect } from 'effect';
import { billedTo } from '../../shared/ai/usage-ledger';
import { requireOwner } from '../../shared/auth/require-member';
import { importRuntime } from './runtime';
import { decodeImportPayload } from './schemas/import-payload';
import { serializableAudioReport } from './services/audio-generation';
import { importVerifiedPage } from './services/import-page';

export const importPage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeImportPayload(input))
  .handler(({ data }) =>
    importRuntime.runPromise(
      // The page fixes the course; its books and units are checked against
      // that course when the entries are written.
      requireOwner(getRequest().headers, { pages: [data.pageId] }).pipe(
        Effect.flatMap((member) =>
          importVerifiedPage(data).pipe(billedTo(member.userId)),
        ),
        Effect.map((result) => ({
          ...result,
          audio: serializableAudioReport(result.audio),
        })),
      ),
    ),
  );
