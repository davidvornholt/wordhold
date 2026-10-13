import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LearnItem } from '../schemas/learning-models';
import { LearnExampleAudio } from './learn-example-audio';

const item: LearnItem = {
  cardId: '00000000-0000-0000-0000-000000000011',
  direction: 'to_target',
  entryId: '00000000-0000-0000-0000-000000000001',
  targetText: 'memory',
  nativeText: 'die Erinnerung',
  hasAudio: true,
  example: null,
  textbookAnswers: ['memory'],
  keyPoints: null,
};

const example = {
  targetText: 'This memory still makes me smile.',
  nativeText: 'Diese Erinnerung bringt mich noch immer zum Lächeln.',
  source: 'textbook' as const,
  hasAudio: true,
};

const render = (shown: LearnItem, pending: boolean) =>
  renderToStaticMarkup(
    <LearnExampleAudio item={shown} pending={pending} targetLanguage="en" />,
  );

describe('LearnExampleAudio', () => {
  it('holds the sentence place while the example is being prepared', () => {
    const html = render(item, true);
    expect(html).toContain('role="status"');
    expect(html).toContain('Beispielsatz wird vorbereitet …');
    expect(html).toContain('Wort anhören');
    expect(html).not.toContain('Satz anhören');
  });

  it('shows the sentence once it has arrived', () => {
    const html = render({ ...item, example }, false);
    expect(html).toContain('This memory still makes me smile.');
    expect(html).toContain('Satz anhören');
    expect(html).not.toContain('Beispielsatz wird vorbereitet');
  });

  it('leaves only the word when no sentence could be prepared', () => {
    const html = render(item, false);
    expect(html).toContain('Wort anhören');
    expect(html).not.toContain('Im Satz');
    expect(html).not.toContain('Beispielsatz wird vorbereitet');
  });
});
