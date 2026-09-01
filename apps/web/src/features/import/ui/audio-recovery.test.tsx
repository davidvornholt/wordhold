import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioRecovery } from './audio-recovery';

describe('AudioRecovery', () => {
  it('keeps a completed import visible and offers audio recovery', () => {
    const markup = renderToStaticMarkup(
      <AudioRecovery
        busy={false}
        imported={4}
        onRetry={() => undefined}
        pending={2}
      />,
    );
    expect(markup).toContain('Import abgeschlossen');
    expect(markup).toContain('4 Einträge wurden importiert');
    expect(markup).toContain('2 Audiodateien fehlen noch');
    expect(markup).toContain('Fehlende Audiodateien erstellen');
  });

  it('disables the retry control while recovery is pending', () => {
    const markup = renderToStaticMarkup(
      <AudioRecovery
        busy={true}
        imported={1}
        onRetry={() => undefined}
        pending={1}
      />,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Audio wird erstellt');
  });
});
