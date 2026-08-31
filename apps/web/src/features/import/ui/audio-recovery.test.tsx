import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioRecovery } from './audio-recovery';

describe('AudioRecovery', () => {
  it('keeps a completed import visible while Wordhold handles pronunciation', () => {
    const markup = renderToStaticMarkup(
      <AudioRecovery busy={false} imported={4} onRetry={() => undefined} />,
    );
    expect(markup).toContain('Import abgeschlossen');
    expect(markup).toContain('4 Einträge wurden importiert');
    expect(markup).toContain('ergänzt die Aussprache automatisch');
    expect(markup).not.toContain('<button');
  });

  it('announces automatic work without exposing a provider action', () => {
    const markup = renderToStaticMarkup(
      <AudioRecovery busy={true} imported={1} onRetry={() => undefined} />,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Aussprache');
    expect(markup).not.toContain('Audio');
  });
});
