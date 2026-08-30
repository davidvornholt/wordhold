import { describe, expect, it } from 'bun:test';
import { prepareSpeechText } from './speech-text';

describe('prepareSpeechText', () => {
  it.each([
    ['de', 'jdn. an etw. erinnern', 'jemanden', 'etwas'],
    ['en', 'to remind sb. of sth.', 'somebody', 'something'],
    ['es', 'decírselo a algn., p. ej. a Ana', 'alguien', 'por ejemplo'],
    ['fr', 'donner qc à qn.', 'quelque chose', 'quelqu&apos;un'],
  ] as const)(
    'substitutes %s abbreviations without changing their written forms',
    (language, text, firstSpokenForm, secondSpokenForm) => {
      const result = prepareSpeechText(text, language);

      expect(result.textType).toBe('ssml');
      expect(result.text).toContain(`alias="${firstSpokenForm}`);
      expect(result.text).toContain(`alias="${secondSpokenForm}`);
      expect(result.text).toContain(text.split(' ')[0] ?? '');
      expect(result.audioProfile).toEndWith('-pronunciation-1');
    },
  );

  it('matches abbreviations case-insensitively at complete token boundaries', () => {
    const result = prepareSpeechText(
      'SB helps, but especially is unchanged.',
      'en',
    );

    expect(result.text).toBe(
      '<speak><sub alias="somebody">SB</sub> helps, but especially is unchanged.</speak>',
    );
  });

  it('allows punctuation-ended abbreviations directly before their value', () => {
    const result = prepareSpeechText('nº5, c/Mayor', 'es');

    expect(result.text).toBe(
      '<speak><sub alias="número">nº</sub>5, <sub alias="calle">c/</sub>Mayor</speak>',
    );
  });

  it('escapes imported text and spoken forms before building SSML', () => {
    const result = prepareSpeechText('fish & chips < qn.', 'fr');

    expect(result.text).toBe(
      '<speak>fish &amp; chips &lt; <sub alias="quelqu&apos;un">qn.</sub></speak>',
    );
  });

  it('keeps plain text and the base voice profile without a substitution', () => {
    expect(prepareSpeechText('mémoire & souvenir', 'fr')).toEqual({
      audioProfile: 'Lea',
      text: 'mémoire & souvenir',
      textType: 'text',
      voice: 'Lea',
    });
  });
});
