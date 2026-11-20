import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SoundControl } from '../../../shared/audio/use-pronunciation-audio';
import type { LearnItem } from '../schemas/learning-models';
import { LearnExample } from './learn-example';

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
  spellingPitfalls: null,
};

const example = {
  targetText: 'This memory still makes me smile.',
  nativeText: 'Diese Erinnerung bringt mich noch immer zum Lächeln.',
  source: 'textbook' as const,
  hasAudio: true,
};

const sound: SoundControl = {
  play: () => Promise.resolve(),
  stop: () => undefined,
  playing: false,
};

const render = (
  shown: LearnItem,
  pending: boolean,
  sentence: SoundControl | null = sound,
) =>
  renderToStaticMarkup(
    <LearnExample
      item={shown}
      pending={pending}
      sentence={sentence}
      targetLanguage="en"
    />,
  );

describe('LearnExample', () => {
  it('holds the sentence place while the example is being prepared', () => {
    const html = render(item, true);
    expect(html).toContain('role="status"');
    expect(html).toContain('Beispielsatz wird vorbereitet …');
    expect(html).not.toContain('Satz anhören');
  });

  it('shows the sentence with its sound once it has arrived', () => {
    const html = render({ ...item, example }, false);
    expect(html).toContain('This memory still makes me smile.');
    expect(html).toContain('Satz anhören');
    expect(html).not.toContain('Beispielsatz wird vorbereitet');
  });

  it('offers no sound for a sentence without a recording', () => {
    const html = render({ ...item, example }, false, null);
    expect(html).toContain('This memory still makes me smile.');
    expect(html).not.toContain('Satz anhören');
  });

  it('leaves no place when no sentence could be prepared', () => {
    expect(render(item, false)).toBe('');
  });
});
