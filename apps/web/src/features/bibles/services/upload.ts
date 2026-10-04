import type { Effect } from 'effect';
import {
  type RequestBodyError,
  readBoundedBody,
} from '../../../shared/http/bounded-body';

const bytesPerKibibyte = 1024;
const kibibytesPerMebibyte = 1024;
// A German Bible module is about 6 MiB and one with Strong's numbers about
// 20 MiB, so 32 MiB leaves room without accepting anything.
const maximumModuleMebibytes = 32;

export const readModuleUpload = (
  request: Request,
): Effect.Effect<Uint8Array, RequestBodyError> =>
  readBoundedBody(request, {
    maximumBytes:
      maximumModuleMebibytes * kibibytesPerMebibyte * bytesPerKibibyte,
    messages: {
      lengthMissing: 'Die Größe der Datei fehlt.',
      tooLarge: `Die Datei ist größer als ${maximumModuleMebibytes} MiB.`,
      empty: 'Die Datei ist leer.',
      unreadable: 'Die Datei konnte nicht empfangen werden.',
    },
  });
