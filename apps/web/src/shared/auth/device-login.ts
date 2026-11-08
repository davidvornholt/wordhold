import { deviceClientId } from '@wordhold/api/device-login';
import { bearer, deviceAuthorization } from 'better-auth/plugins';

// `wordhold login` asks for a device code, the member approves it at /device,
// and the command then sends the session token as a bearer token. Whether
// that session may still be used is decided per request, as for the browser.
export const commandLinePlugins = () =>
  [
    deviceAuthorization({
      expiresIn: '15m',
      validateClient: (clientId) => clientId === deviceClientId,
      verificationUri: '/device',
    }),
    bearer(),
  ] as const;
