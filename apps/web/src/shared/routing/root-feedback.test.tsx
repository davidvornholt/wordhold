import { describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RootError, RootNotFound, RootPending } from './root-feedback';
import { retryRoute } from './root-feedback-state';

describe('root route feedback', () => {
  it('offers retry and sign-in recovery after a dependency failure', () => {
    const reset = mock(() => undefined);
    const markup = renderToStaticMarkup(
      <RootError
        error={new Error('Datenbank nicht erreichbar.')}
        reset={reset}
      />,
    );

    expect(markup).toContain('Erneut versuchen');
    expect(markup).toContain('Zur Startseite und Anmeldung');
    retryRoute(reset);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('uses not-found recovery for a missing record', () => {
    const markup = renderToStaticMarkup(
      <RootError
        error={new Error('Seite nicht gefunden.')}
        reset={() => undefined}
      />,
    );

    expect(markup).toContain('Diese Seite wurde nicht gefunden.');
    expect(markup).toContain('href="/"');
  });

  it('gives unknown routes a home recovery', () => {
    const markup = renderToStaticMarkup(<RootNotFound />);
    expect(markup).toContain('Zur Übersicht');
  });

  it('announces pending loader navigation', () => {
    const markup = renderToStaticMarkup(<RootPending />);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Seite wird geladen');
  });
});
