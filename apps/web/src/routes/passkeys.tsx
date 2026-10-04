import { createFileRoute, useRouter } from '@tanstack/react-router';
import { newPasskeyName } from '../features/access/schemas/passkey-models';
import { listOwnPasskeys } from '../features/access/services/server-fns';
import { PasskeysScreen } from '../features/access/ui/passkeys-screen';
import { authClient, rejectAuthError } from '../shared/auth/client';
import { BackLink } from '../shared/ui/back-link';
import { PageLayout } from '../shared/ui/page-layout';

const Passkeys = () => {
  const passkeys = Route.useLoaderData();
  const router = useRouter();
  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title="Passkeys"
    >
      <PasskeysScreen
        add={async () => {
          rejectAuthError(
            await authClient.passkey.addPasskey({
              name: newPasskeyName(new Date()),
            }),
          );
          await router.invalidate();
        }}
        passkeys={passkeys}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/passkeys')({
  loader: () => listOwnPasskeys(),
  component: Passkeys,
});
