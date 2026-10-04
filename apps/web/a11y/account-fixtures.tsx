import { HomeShell } from '../src/app/home-shell';
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
