import { describe, expect, it } from 'bun:test';
import { prepareSpeechText } from './speech-text';

describe('Polly speech profiles', () => {
  it.each([
    ['de', 'Vicki', 'de-DE'],
    ['en', 'Stephen', 'en-US'],
    ['es', 'Sergio', 'es-ES'],
    ['fr', 'Remi', 'fr-FR'],
  ] as const)(
    'uses the selected generative %s voice',
    (language, voice, languageCode) => {
      expect(prepareSpeechText('A complete sentence.', language)).toEqual({
        audioProfile: `${voice}-generative`,
        engine: 'generative',
        languageCode,
        text: 'A complete sentence.',
        textType: 'text',
        voice,
      });
    },
  );
});

describe('SSML pronunciation and pauses', () => {
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
      expect(result.audioProfile).toContain('-generative-pronunciation-1');
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
    expect(result.text).not.toContain('<break');
  });

  it('replaces separator slashes with the selected short pause', () => {
    expect(prepareSpeechText('friend / companion', 'en')).toEqual({
      audioProfile: 'Stephen-generative-slash-pause-25ms',
      engine: 'generative',
      languageCode: 'en-US',
      text: '<speak>friend <break time="25ms"/> companion</speak>',
      textType: 'ssml',
      voice: 'Stephen',
    });
    expect(prepareSpeechText('amigo/a', 'es').text).toBe(
      '<speak>amigo<break time="25ms"/>a</speak>',
    );
  });

  it('combines pronunciation aliases with separator pauses', () => {
    expect(prepareSpeechText('sb. / sth.', 'en')).toMatchObject({
      audioProfile: 'Stephen-generative-pronunciation-1-slash-pause-25ms',
      text: '<speak><sub alias="somebody">sb.</sub> <break time="25ms"/> <sub alias="something">sth.</sub></speak>',
      textType: 'ssml',
    });
  });

  it('leaves other punctuation to the generative voice', () => {
    const text = 'Well, this; sentence (still) flows.';

    expect(prepareSpeechText(text, 'en')).toMatchObject({
      text,
      textType: 'text',
    });
  });
});

describe('speech text sanitation', () => {
  it('escapes imported text and spoken forms before building SSML', () => {
    const result = prepareSpeechText('fish & chips < qn.', 'fr');

    expect(result.text).toBe(
      '<speak>fish &amp; chips &lt; <sub alias="quelqu&apos;un">qn.</sub></speak>',
    );
  });

  it('keeps plain text and the base voice profile without a substitution', () => {
    expect(prepareSpeechText('mémoire & souvenir', 'fr')).toEqual({
      audioProfile: 'Remi-generative',
      engine: 'generative',
      languageCode: 'fr-FR',
      text: 'mémoire & souvenir',
      textType: 'text',
      voice: 'Remi',
    });
  });

  it('removes XML-forbidden characters from SSML and plain text', () => {
    const source =
      'donner qc à qn.\u0000\u0008\u000B\u000C\u000E\u001F\uFFFE\uFFFF\uD800';
    const ssml = prepareSpeechText(source, 'fr');
    const plain = prepareSpeechText('mémoire\u0001\uFFFE\uDFFF', 'fr');

    expect(ssml.text).toBe(
      '<speak>donner <sub alias="quelque chose">qc</sub> à <sub alias="quelqu&apos;un">qn.</sub>         </speak>',
    );
    expect(plain).toEqual({
      audioProfile: 'Remi-generative',
      engine: 'generative',
      languageCode: 'fr-FR',
      text: 'mémoire   ',
      textType: 'text',
      voice: 'Remi',
    });
    expect(prepareSpeechText(source, 'fr').audioProfile).toBe(
      ssml.audioProfile,
    );
  });

  it('keeps a removed control from joining adjacent words into an abbreviation', () => {
    expect(prepareSpeechText('s\u0001b', 'en')).toEqual({
      audioProfile: 'Stephen-generative',
      engine: 'generative',
      languageCode: 'en-US',
      text: 's b',
      textType: 'text',
      voice: 'Stephen',
    });
  });

  it('does not expand abbreviations split by a forbidden character', () => {
    expect(prepareSpeechText('z.\u0001B.', 'de')).toEqual({
      audioProfile: 'Vicki-generative',
      engine: 'generative',
      languageCode: 'de-DE',
      text: 'z. B.',
      textType: 'text',
      voice: 'Vicki',
    });
    expect(prepareSpeechText('p.\u0001ex.', 'fr')).toEqual({
      audioProfile: 'Remi-generative',
      engine: 'generative',
      languageCode: 'fr-FR',
      text: 'p. ex.',
      textType: 'text',
      voice: 'Remi',
    });
  });

  it('preserves XML-allowed whitespace and supplementary characters', () => {
    expect(prepareSpeechText('a\t b\n c\r 😀', 'fr').text).toBe(
      'a\t b\n c\r 😀',
    );
  });
});
