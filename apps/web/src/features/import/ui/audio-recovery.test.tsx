import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioRecovery } from './audio-recovery';

describe('AudioRecovery', () => {
  it('keeps a completed import visible while Wordhold handles pronunciation', () => {
    const markup = renderToStaticMarkup(
      <AudioRecovery
        busy={false}
        error={null}
        imported={4}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('Import abgeschlossen');
    expect(markup).toContain('4 Einträge wurden importiert');
    expect(markup).toContain('ergänzt die Aussprache automatisch');
    expect(markup).not.toContain('<button');
  });

  it('announces automatic work without exposing a provider action', () => {
    const markup = renderToStaticMarkup(
      <AudioRecovery
        busy={true}
        error={null}
        imported={1}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Aussprache wird erstellt …');
    expect(markup).not.toContain('Audio');
  });

  it('offers another attempt after automatic recovery fails', () => {
    const markup = renderToStaticMarkup(
      <AudioRecovery
        busy={false}
        error="Provider unavailable"
        imported={1}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(
      'Die Aussprache konnte noch nicht erstellt werden.',
    );
    expect(markup).toContain('Erneut versuchen');
    expect(markup).not.toContain('Provider unavailable');
  });
});
