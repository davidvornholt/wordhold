import { createServerFn } from '@tanstack/react-start';
import { serverEnv } from '../env/server';

const getOwnerTimeZone = createServerFn().handler(() =>
  serverEnv.ownerTimeZone(),
);

let ownerTimeZone: Promise<string> | undefined;

// The zone is fixed while the server runs, so the root route's loader asks
// for it once per page load rather than again on every router.invalidate().
export const loadOwnerTimeZone = (): Promise<string> => {
  ownerTimeZone ??= getOwnerTimeZone().catch((cause: unknown) => {
    ownerTimeZone = undefined;
    throw cause;
  });
  return ownerTimeZone;
};
