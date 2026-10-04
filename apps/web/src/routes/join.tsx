import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { newPasskeyName } from '../features/access/schemas/passkey-models';
import { JoinScreen } from '../features/access/ui/join-screen';
import { authClient, rejectAuthError } from '../shared/auth/client';
import { BackLink } from '../shared/ui/back-link';
import { PageLayout } from '../shared/ui/page-layout';

// The code travels in the link's fragment, which browsers never send to the
// server, and is removed from the address bar once read.
const takeCodeFromAddress = (): string => {
  const code = globalThis.location.hash.slice(1);
  if (code !== '') {
    globalThis.history.replaceState(
      globalThis.history.state,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}`,
    );
  }
  return code;
};

const Join = () => {
  const router = useRouter();
  const navigate = useNavigate();
  const [initialCode, setInitialCode] = useState('');
  useEffect(() => {
    setInitialCode(takeCodeFromAddress());
  }, []);

  return (
    <PageLayout
      backControl={<BackLink to="/">Anmeldung</BackLink>}
      title="Passkey einrichten"
    >
      <JoinScreen
        initialCode={initialCode}
        // The field starts over with the code once it was read from the link.
        key={initialCode}
        register={async (code) => {
          // With a session, Better Auth would add the passkey to the signed-in
          // account instead of the one the code belongs to.
          await authClient.signOut();
          rejectAuthError(
            await authClient.passkey.addPasskey({
              context: code,
              createSession: true,
              name: newPasskeyName(new Date()),
            }),
          );
          await router.invalidate();
          await navigate({ to: '/' });
        }}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/join')({
  component: Join,
});
