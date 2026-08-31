import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionStart } from './session-start';

const options = [
  {
    value: 'to_target',
    label: 'Deutsch → Englisch',
    description: 'Du übersetzt ins Englische.',
    cards: 4,
  },
  {
    value: 'to_native',
    label: 'Englisch → Deutsch',
    description: 'Du übersetzt ins Deutsche.',
    cards: 0,
  },
] as const;

const render = () =>
  renderToStaticMarkup(
    <SessionStart
      options={options}
      preferenceKey="test:practice"
      renderStartAction={(option) => (
        <button type="button">{option.cards} starten</button>
      )}
    />,
  );

describe('SessionStart', () => {
  it('disables directions without ready cards', () => {
    const markup = render();
    expect(markup).toContain('Keine Karten bereit');
    expect(markup).toContain('disabled=""');
  });

  it('asks for an explicit choice before offering a start action', () => {
    const markup = render();
    expect(markup).not.toContain('starten');
    expect(markup).toContain('Wähle eine Richtung');
  });
});
