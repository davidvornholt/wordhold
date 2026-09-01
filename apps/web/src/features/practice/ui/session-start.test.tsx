import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionStart } from './session-start';

const options = [
  {
    value: 'to_target',
    label: 'Deutsch → Englisch',
    description: 'Du übersetzt ins Englische.',
    cards: 4,
    availability: 'available',
  },
  {
    value: 'to_native',
    label: 'Englisch → Deutsch',
    description: 'Du übersetzt ins Deutsche.',
    cards: 0,
    availability: 'no_cards',
  },
  {
    value: 'both',
    label: 'Gemischt',
    description: 'Beide Richtungen in einer Sitzung.',
    cards: 4,
    availability: 'needs_both_directions',
  },
] as const;

const render = () =>
  renderToStaticMarkup(
    <SessionStart
      itemNoun={{ singular: 'Karte', plural: 'Karten' }}
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

  it('disables mixed practice when one direction has no cards', () => {
    const markup = render();
    expect(markup).toContain('In einer Richtung fehlen Karten');
    expect(markup).toContain('disabled="" id="practice-direction-both"');
  });

  it('asks for an explicit choice before offering a start action', () => {
    const markup = render();
    expect(markup).not.toContain('starten');
    expect(markup).toContain('Wähle eine Richtung');
  });
});
