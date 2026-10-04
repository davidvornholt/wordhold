import { describe, expect, it } from 'bun:test';
import {
  allowedMistakes,
  compareRecitation,
  copyMistakeMessage,
  isVerbatimCopy,
  recitationSegments,
} from './recitation';

// From the Luther Bible of 1912, which is in the public domain.
const verse =
  'Also hat Gott die Welt geliebt, daß er seinen eingeborenen Sohn gab.';

const typed = { dictated: false } as const;
const dictated = { dictated: true } as const;

const kinds = (
  original: string,
  recited: string,
  input: { readonly dictated: boolean } = typed,
) =>
  compareRecitation(original, recited, input).steps.map((step) =>
    step.kind === 'extra'
      ? `+${step.typed.text}`
      : `${step.kind}:${step.expected.text}`,
  );

describe('compareRecitation', () => {
  it('ignores case, punctuation and line breaks', () => {
    expect(
      compareRecitation(
        verse,
        'also hat gott die welt\ngeliebt dass er seinen eingeborenen sohn gab',
        typed,
      ),
    ).toMatchObject({ words: 12, mistakes: 0, typos: 0 });
  });

  it('treats umlauts written out and ß as ss as the same word', () => {
    expect(
      compareRecitation(
        'Süße Grüße für Jörg',
        'suesse gruesse fuer joerg',
        typed,
      ),
    ).toMatchObject({ mistakes: 0, typos: 0 });
  });

  it('counts one slip in a long word as a typo, not a mistake', () => {
    const recitation = compareRecitation(
      verse,
      'Also hat Gott die Welt geliebt, daß er seinen eingebroenen Sohn gab.',
      typed,
    );
    expect(recitation).toMatchObject({ mistakes: 0, typos: 1 });
    expect(recitation.steps.at(-3)).toMatchObject({
      kind: 'typo',
      expected: { text: 'eingeborenen' },
      typed: { text: 'eingebroenen' },
    });
  });

  it('never counts a short word with another letter as a typo', () => {
    expect(kinds('mit dem Herrn', 'mit den Herrn')).toEqual([
      'same:mit',
      'wrong:dem',
      'same:Herrn',
    ]);
  });

  it('aligns missing and extra words instead of shifting the rest', () => {
    expect(
      kinds(
        'Der Herr ist mein Hirte, mir wird nichts mangeln.',
        'Der Herr ist mein guter Hirte, mir wird nichts fehlen.',
      ),
    ).toEqual([
      'same:Der',
      'same:Herr',
      'same:ist',
      'same:mein',
      '+guter',
      'same:Hirte',
      'same:mir',
      'same:wird',
      'same:nichts',
      'wrong:mangeln',
    ]);
    expect(kinds('Jesus weinte.', 'Jesus')).toEqual([
      'same:Jesus',
      'missing:weinte',
    ]);
  });

  it('counts every word of an empty answer as missing', () => {
    expect(compareRecitation(verse, '', typed)).toMatchObject({
      words: 12,
      mistakes: 12,
    });
  });
});

describe('compareRecitation of a dictated answer', () => {
  // From the Luther Bible of 1912, which is in the public domain.
  const hope =
    'Seid fröhlich in Hoffnung, geduldig in Trübsal, haltet an am Gebet.';

  it('tolerates a word that sounds right but is spelled another way', () => {
    const spoken =
      'seit fröhlich in Hoffnung geduldig in Trübsal haltet an am Gebet';
    expect(compareRecitation(hope, spoken, dictated)).toMatchObject({
      mistakes: 0,
      typos: 0,
      soundAlikes: 1,
    });
    expect(compareRecitation(hope, spoken, typed)).toMatchObject({
      mistakes: 1,
      soundAlikes: 0,
    });
  });

  it('tells words that sound the same from words that only sound similar', () => {
    expect(
      kinds('Der Herr ist mein Hirte', 'der Herr ist mein Hüter', dictated),
    ).toContain('wrong:Hirte');
    expect(kinds('Das ist wahr.', 'das ist war', dictated)).toEqual([
      'same:Das',
      'same:ist',
      'soundAlike:wahr',
    ]);
  });

  it('counts a wrong ending as a mistake even when it sounds close', () => {
    expect(
      kinds('Im Anfang war das Wort', 'in Anfang war das Wort', dictated),
    ).toContain('wrong:Im');
    expect(
      compareRecitation(
        'und den Armen wird das Evangelium gepredigt',
        'und dem Armen wird das Evangelium gepredigt',
        dictated,
      ),
    ).toMatchObject({ mistakes: 1, soundAlikes: 0 });
  });

  it('matches numbers spoken as digits with numbers written out', () => {
    expect(
      compareRecitation(
        'Ich will ihnen noch Frist geben hundertundzwanzig Jahre.',
        'ich will ihnen noch Frist geben 120 Jahre',
        dictated,
      ),
    ).toMatchObject({ mistakes: 0, soundAlikes: 0 });
    expect(
      compareRecitation(
        'Und also vollendete Gott am siebenten Tage seine Werke.',
        'und also vollendete Gott am 7. Tage seine Werke',
        dictated,
      ),
    ).toMatchObject({ mistakes: 0, soundAlikes: 0 });
    expect(
      compareRecitation(
        'Es waren 144 000.',
        'es waren hundertvierundvierzigtausend',
        dictated,
      ),
    ).toMatchObject({ words: 3, mistakes: 0 });
    expect(
      compareRecitation('Es waren 144 000.', 'es waren 144.000', typed),
    ).toMatchObject({ words: 3, mistakes: 0 });
  });

  it('does not take a number for another one', () => {
    expect(
      compareRecitation('Es waren zwölf Körbe.', 'es waren 11 Körbe', dictated),
    ).toMatchObject({ mistakes: 1 });
    expect(
      compareRecitation('Es waren 12 Körbe.', 'es waren elf Körbe', dictated),
    ).toMatchObject({ mistakes: 1 });
  });
});

describe('allowedMistakes', () => {
  it('allows one mistake per ten words and none in a short text', () => {
    expect(allowedMistakes(2)).toBe(0);
    expect(allowedMistakes(9)).toBe(0);
    expect(allowedMistakes(10)).toBe(1);
    expect(allowedMistakes(25)).toBe(2);
  });
});

describe('isVerbatimCopy', () => {
  it('accepts a copy without its punctuation but not with a typo', () => {
    expect(isVerbatimCopy(verse, verse.replaceAll(',', ''))).toBe(true);
    expect(isVerbatimCopy(verse, verse.replace('geliebt', 'gelibt'))).toBe(
      false,
    );
  });
});

describe('recitationSegments', () => {
  it('keeps the original punctuation and puts extra words where they were typed', () => {
    const original = 'Gott, der Herr,\nist gut.';
    expect(
      recitationSegments(
        original,
        compareRecitation(original, 'Gott mein der Hirr ist', typed),
      ),
    ).toEqual([
      { kind: 'same', text: 'Gott' },
      { kind: 'text', text: ', ' },
      { kind: 'extra', typed: 'mein' },
      { kind: 'text', text: ' ' },
      { kind: 'same', text: 'der' },
      { kind: 'text', text: ' ' },
      { kind: 'wrong', text: 'Herr', typed: 'Hirr' },
      { kind: 'text', text: ',\n' },
      { kind: 'same', text: 'ist' },
      { kind: 'text', text: ' ' },
      { kind: 'missing', text: 'gut' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('shows what a word that sounds right was heard as', () => {
    expect(
      recitationSegments(
        'Seid fröhlich.',
        compareRecitation('Seid fröhlich.', 'seit fröhlich', dictated),
      ),
    ).toEqual([
      { kind: 'soundAlike', text: 'Seid', typed: 'seit' },
      { kind: 'text', text: ' ' },
      { kind: 'same', text: 'fröhlich' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('adds words typed after the end of the text at the end', () => {
    expect(
      recitationSegments(
        'Jesus weinte.',
        compareRecitation('Jesus weinte.', 'Jesus weinte Amen', typed),
      ),
    ).toEqual([
      { kind: 'same', text: 'Jesus' },
      { kind: 'text', text: ' ' },
      { kind: 'same', text: 'weinte' },
      { kind: 'text', text: '.' },
      { kind: 'text', text: ' ' },
      { kind: 'extra', typed: 'Amen' },
    ]);
  });
});

describe('copyMistakeMessage', () => {
  it('names the first word that differs, counted in the original', () => {
    expect(copyMistakeMessage(verse, 'Also hat Gott der Welt')).toBe(
      'Noch nicht ganz: Das 4. Wort ist „die“, nicht „der“.',
    );
  });

  it('names a word left out in the middle', () => {
    expect(copyMistakeMessage('Jesus weinte sehr.', 'Jesus sehr')).toBe(
      'Noch nicht ganz: Als 2. Wort fehlt „weinte“.',
    );
  });

  it('shows what is still missing at the end', () => {
    expect(copyMistakeMessage(verse, 'Also hat')).toBe(
      'Noch nicht ganz: Es fehlt noch „Gott die Welt geliebt daß er …“.',
    );
  });

  it('names an extra word', () => {
    expect(copyMistakeMessage('Jesus weinte.', 'Jesus weinte laut')).toBe(
      'Noch nicht ganz: „laut“ gehört nicht dazu.',
    );
  });

  it('is null for a matching copy', () => {
    expect(copyMistakeMessage(verse, verse.toLowerCase())).toBeNull();
  });
});
