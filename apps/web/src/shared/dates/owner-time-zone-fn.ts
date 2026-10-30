import { createServerFn } from '@tanstack/react-start';
import { serverEnv } from '../env/server';

const getOwnerTimeZone = createServerFn().handler(() =>
  serverEnv.ownerTimeZone(),
);

let ownerTimeZone: Promise<string> | undefined;

// A successful result is kept for the life of the runtime, because the zone
// doesn't change while the server runs, so router.invalidate() doesn't
// request it again.
export const loadOwnerTimeZone = (): Promise<string> => {
  ownerTimeZone ??= getOwnerTimeZone().catch((cause: unknown) => {
    ownerTimeZone = undefined;
    throw cause;
  });
  return ownerTimeZone;
};
