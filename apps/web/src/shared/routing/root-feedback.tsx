import type { ErrorComponentProps } from '@tanstack/react-router';
import { isMissingRecordError, retryRoute } from './root-feedback-state';

type RecoveryPageProps = {
  readonly children: React.ReactNode;
};

const RecoveryPage = ({ children }: RecoveryPageProps) => (
  <main className="root-recovery">
    <p className="root-feedback-brand">Wordhold</p>
    {children}
  </main>
);

export const RootNotFound = () => (
  <RecoveryPage>
    <h1 className="root-feedback-heading">Diese Seite wurde nicht gefunden.</h1>
    <p className="root-feedback-copy">
      Der Link ist nicht mehr gültig oder die Seite wurde entfernt.
    </p>
    <a className="root-feedback-link" href="/">
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
      <h1 className="root-feedback-heading">
        Wordhold konnte diese Seite nicht laden.
      </h1>
      <p className="root-feedback-copy">
        Versuche es erneut. Wenn deine Anmeldung abgelaufen ist, kehre zur
        Startseite zurück und melde dich neu an.
      </p>
      <div className="root-feedback-actions">
        <button
          className="root-feedback-button"
          onClick={() => retryRoute(reset)}
          type="button"
        >
          Erneut versuchen
        </button>
        <a className="root-feedback-link" href="/">
          Zur Startseite und Anmeldung
        </a>
      </div>
    </RecoveryPage>
  );
};

export const RootPending = () => (
  <main aria-busy="true" className="root-pending">
    <p aria-live="polite" className="root-feedback-copy" role="status">
      Seite wird geladen …
    </p>
  </main>
);
