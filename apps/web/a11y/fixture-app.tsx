import { DashboardFixture, SignedOutFixture } from './dashboard-fixtures';
import { navigateToFixture, readFixtureState } from './fixture-state';
import { ImportFixture, VerificationFixture } from './import-fixtures';
import {
  PracticeEmptyFixture,
  PracticeFeedbackFixture,
  PracticeFixture,
} from './practice-fixtures';

const RootPendingFixture = () => (
  <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
    <p aria-live="polite" className="text-neutral-600">
      Wordhold wird geladen …
    </p>
  </main>
);

const RootErrorFixture = () => (
  <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center gap-4 p-6">
    <h1 className="font-semibold text-2xl">Wordhold konnte nicht laden</h1>
    <p className="text-neutral-600">
      Beim Laden ist etwas schiefgegangen. Versuche es noch einmal.
    </p>
    <button
      className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
      onClick={() => navigateToFixture('dashboard')}
      type="button"
    >
      Erneut versuchen
    </button>
  </main>
);

const RootNotFoundFixture = () => (
  <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center gap-4 p-6">
    <h1 className="font-semibold text-2xl">Seite nicht gefunden</h1>
    <p className="text-neutral-600">
      Diese Seite existiert nicht oder wurde verschoben.
    </p>
    <button
      className="text-sm underline"
      onClick={() => navigateToFixture('dashboard')}
      type="button"
    >
      Zur Übersicht
    </button>
  </main>
);

export const FixtureApp = () => {
  const state = readFixtureState();
  switch (state) {
    case 'signed-out':
      return <SignedOutFixture />;
    case 'dashboard':
      return <DashboardFixture />;
    case 'dashboard-empty':
      return <DashboardFixture empty={true} />;
    case 'import':
      return <ImportFixture />;
    case 'import-error':
      return <ImportFixture error={true} />;
    case 'verification':
      return <VerificationFixture />;
    case 'verification-empty':
      return <VerificationFixture empty={true} />;
    case 'verification-audio-recovery':
      return <VerificationFixture audioRecovery={true} />;
    case 'practice':
      return <PracticeFixture />;
    case 'practice-feedback':
      return <PracticeFeedbackFixture />;
    case 'practice-empty':
      return <PracticeEmptyFixture />;
    case 'loading':
      return <RootPendingFixture />;
    case 'error':
      return <RootErrorFixture />;
    case 'not-found':
      return <RootNotFoundFixture />;
    default:
      return state satisfies never;
  }
};
