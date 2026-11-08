import { HomeShell } from '../src/app/home-shell';
import { DeviceScreen } from '../src/features/access/ui/device-screen';
import { JoinScreen } from '../src/features/access/ui/join-screen';
import { PasskeysScreen } from '../src/features/access/ui/passkeys-screen';
import { SignInPanel } from '../src/features/access/ui/sign-in-panel';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const signIn = async () => navigateToFixture('dashboard');

export const SignedOutFixture = () => (
  <HomeShell
    accountLinks={null}
    onSignOut={() => undefined}
    signIn={
      <SignInPanel
        joinLink={fixtureControl(
          'Einladung oder Wiederherstellungscode einlösen',
          'join',
          'quiet',
        )}
        signInWithGithub={signIn}
        signInWithPasskey={signIn}
      />
    }
    user={null}
  >
    {null}
  </HomeShell>
);

export const JoinFixture = () => (
  <PageLayout
    backControl={fixtureBackControl('Anmeldung', 'signed-out')}
    title="Passkey einrichten"
  >
    <JoinScreen
      initialCode="kD3p9xQv2mLw8RtY5nJc7HsF4aZb6UeG1oViXyNq0Tw"
      register={signIn}
    />
  </PageLayout>
);

const savedDay = new Date('2026-08-20T09:30:00Z');

export const PasskeysFixture = () => (
  <PageLayout
    backControl={fixtureBackControl('Übersicht', 'dashboard')}
    title="Passkeys"
  >
    <PasskeysScreen
      add={async () => undefined}
      passkeys={[
        {
          id: 'passkey-phone',
          name: 'Passkey vom 20. August 2026',
          createdAt: savedDay,
          backedUp: true,
        },
        {
          id: 'passkey-key',
          name: null,
          createdAt: null,
          backedUp: false,
        },
      ]}
    />
  </PageLayout>
);

// Any code but XXXXXXXX is waiting for approval, so a flow test can reach the
// expired-code message too.
export const DeviceFixture = ({ code }: { readonly code: string }) => (
  <PageLayout
    backControl={fixtureBackControl('Übersicht', 'dashboard')}
    title="Befehlszeile anmelden"
  >
    <DeviceScreen
      check={(typed) =>
        typed === 'XXXXXXXX'
          ? Promise.reject(new Error('Unknown code'))
          : Promise.resolve('pending')
      }
      decide={async () => undefined}
      initialCode={code}
    />
  </PageLayout>
);
