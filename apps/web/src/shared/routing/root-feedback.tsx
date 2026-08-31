import type { ErrorComponentProps } from '@tanstack/react-router';
import { actionClass } from '../ui/action-styles';
import { Button } from '../ui/button';
import { isMissingRecordError, retryRoute } from './root-feedback-state';

type RecoveryPageProps = {
  readonly children: React.ReactNode;
};

const RecoveryPage = ({ children }: RecoveryPageProps) => (
  <main className="page-column flex min-h-screen flex-col justify-center gap-5 p-6">
    <p className="font-semibold text-muted-foreground text-sm">Wordhold</p>
    {children}
  </main>
);

// Recovery pages render before the router is ready, so they use plain anchors
// instead of typed router links.
export const RootNotFound = () => (
  <RecoveryPage>
    <h1 className="font-display font-semibold text-2xl">
      Diese Seite wurde nicht gefunden.
    </h1>
    <p className="text-muted-foreground text-sm">
      Der Link ist nicht mehr gültig oder die Seite wurde entfernt.
    </p>
    <a className={actionClass('quiet', 'w-fit')} href="/">
      Zur Übersicht
    </a>
  </RecoveryPage>
);

export const RootError = ({ error, reset }: ErrorComponentProps) => {
  if (isMissingRecordError(error)) {
    return <RootNotFound />;
  }

  return (
    <RecoveryPage>
      <h1 className="font-display font-semibold text-2xl">
        Wordhold konnte diese Seite nicht laden.
      </h1>
      <p className="text-muted-foreground text-sm">
        Versuche es erneut. Wenn deine Anmeldung abgelaufen ist, kehre zur
        Startseite zurück und melde dich neu an.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => retryRoute(reset)}>Erneut versuchen</Button>
        <a className={actionClass('quiet')} href="/">
          Zur Startseite und Anmeldung
        </a>
      </div>
    </RecoveryPage>
  );
};

export const RootPending = () => (
  <main aria-busy="true" className="page-column flex min-h-screen items-center p-6">
    <p
      aria-live="polite"
      className="text-muted-foreground text-sm"
      role="status"
    >
      Seite wird geladen …
    </p>
  </main>
);
