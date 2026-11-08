import { createFileRoute } from '@tanstack/react-router';
import {
  type DeviceDecision,
  DeviceScreen,
  type DeviceStatus,
} from '../features/access/ui/device-screen';
import { authClient, rejectAuthError } from '../shared/auth/client';
import { BackLink } from '../shared/ui/back-link';
import { PageLayout } from '../shared/ui/page-layout';

const check = async (code: string): Promise<DeviceStatus> => {
  const { data } = rejectAuthError(
    await authClient.device({
      query: { user_code: code },
    }),
  );
  // A code is pending until approved or denied; anything else is unknown.
  switch (data?.status) {
    case 'pending':
    case 'approved':
    case 'denied':
      return data.status;
    default:
      throw new Error('Unknown device code status');
  }
};

const decide = async (code: string, decision: DeviceDecision) => {
  rejectAuthError(
    decision === 'approve'
      ? await authClient.device.approve({ userCode: code })
      : await authClient.device.deny({ userCode: code }),
  );
};

const Device = () => {
  const { code } = Route.useSearch();
  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title="Befehlszeile anmelden"
    >
      <DeviceScreen check={check} decide={decide} initialCode={code} />
    </PageLayout>
  );
};

export const Route = createFileRoute('/device')({
  // `wordhold login` links here with the code in RFC 8628's `user_code`.
  validateSearch: (input: Record<string, unknown>) => {
    const code = input.user_code;
    return {
      code: typeof code === 'string' ? code.trim().toUpperCase() : '',
    };
  },
  component: Device,
});
