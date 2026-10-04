import { describe, expect, it } from 'bun:test';
import { type ModuleVerse, moduleVerses } from './module-verses';

// Verses from the Luther Bible of 1912, which is in the public domain,
// marked up the way MySword modules mark up a modern translation.
const row = (
  book: number,
  chapter: number,
  verse: number,
  scripture: string,
): ModuleVerse => ({ book, chapter, verse, scripture });

const numbered = (rows: ReadonlyArray<ModuleVerse>) =>
  moduleVerses(rows).map(
    ({ chapter, verse, text }) => `${chapter},${verse} ${text}`,
  );

describe('moduleVerses text', () => {
  it('leaves out headings, footnotes and cross references', () => {
    expect(
      numbered([
        row(
          43,
          3,
          16,
          '<TS>Gottes Liebe<Ts>Also hat Gott die Welt geliebt,<RF>Oder: so sehr geliebt<Rf> daß er seinen eingebornen Sohn gab,<RX 45.5.8><CM>auf daß alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben.',
        ),
      ]),
    ).toEqual([
      '3,16 Also hat Gott die Welt geliebt, daß er seinen eingebornen Sohn gab, auf daß alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben.',
    ]);
  });

  it('keeps the lines of poetry and drops the marks that are not read', () => {
    expect(
      numbered([
        row(
          19,
          23,
          4,
          'Und ob ich schon wanderte im finstern Tal, / fürchte ich kein Unglück; / denn ‹du› bist bei mir, ♪<CL>dein Stecken und Stab trösten mich. /',
        ),
      ]),
    ).toEqual([
      '23,4 Und ob ich schon wanderte im finstern Tal,\nfürchte ich kein Unglück;\ndenn du bist bei mir,\ndein Stecken und Stab trösten mich.',
    ]);
    expect(
      numbered([row(26, 45, 11, 'Ein Epha soll 1/10 Homer haben.')]),
    ).toEqual(['45,11 Ein Epha soll 1/10 Homer haben.']);
  });

  it('starts a Psalm with its first words when it shares a verse with the superscription', () => {
    expect(
      numbered([
        row(
          19,
          23,
          1,
          '<i>Ein Psalm Davids.</i><CM>Der HERR ist mein Hirte; / mir wird nichts mangeln.',
        ),
      ]),
    ).toEqual(['23,1 Der HERR ist mein Hirte;\nmir wird nichts mangeln.']);
  });
});

describe('moduleVerses numbering', () => {
  it('numbers verses the way the translation does where the module differs', () => {
    expect(
      numbered([
        row(
          19,
          51,
          1,
          '<i>Ein Psalm Davids, vorzusingen;</i> (2) <i>da der Prophet Nathan zu ihm kam,</i> (3) Gott, sei mir gnädig nach deiner Güte,',
        ),
        row(
          19,
          51,
          2,
          '(4) Wasche mich wohl von meiner Missetat, und reinige mich von meiner Sünde;',
        ),
      ]),
    ).toEqual([
      '51,1 Ein Psalm Davids, vorzusingen;',
      '51,2 da der Prophet Nathan zu ihm kam,',
      '51,3 Gott, sei mir gnädig nach deiner Güte,',
      '51,4 Wasche mich wohl von meiner Missetat, und reinige mich von meiner Sünde;',
    ]);
  });

  it('moves verses into the next chapter where the translation starts it earlier', () => {
    expect(
      numbered([
        row(
          29,
          2,
          27,
          'Und ihr sollt erfahren, daß ich mitten unter Israel sei.',
        ),
        row(
          29,
          2,
          28,
          '(1) Und nach diesem will ich meinen Geist ausgießen über alles Fleisch;',
        ),
        row(
          29,
          2,
          29,
          '(2) Auch will ich zur selben Zeit meinen Geist ausgießen.',
        ),
        row(29, 3, 1, '(4,1) Denn siehe, in den Tagen und zur selben Zeit,'),
      ]),
    ).toEqual([
      '2,27 Und ihr sollt erfahren, daß ich mitten unter Israel sei.',
      '3,1 Und nach diesem will ich meinen Geist ausgießen über alles Fleisch;',
      '3,2 Auch will ich zur selben Zeit meinen Geist ausgießen.',
      '4,1 Denn siehe, in den Tagen und zur selben Zeit,',
    ]);
  });

  it('adds the first half of a split verse to the verse before', () => {
    expect(
      numbered([
        row(
          23,
          63,
          19,
          'Wir sind gleich wie vorhin, da du nicht über uns herrschtest.',
        ),
        row(
          23,
          64,
          1,
          '(63,19b) Ach daß du den Himmel zerrissest und führest herab, (1) daß die Berge vor dir zerflössen,',
        ),
      ]),
    ).toEqual([
      '63,19 Wir sind gleich wie vorhin, da du nicht über uns herrschtest. Ach daß du den Himmel zerrissest und führest herab,',
      '64,1 daß die Berge vor dir zerflössen,',
    ]);
  });
});

describe('moduleVerses numbering against the module', () => {
  it('continues the verse the translation is at when the module numbers ahead', () => {
    expect(
      numbered([
        row(10, 19, 8, '(9) Da machte sich der König auf'),
        row(10, 19, 9, 'und setzte sich ins Tor.'),
        row(10, 19, 10, '(10) Und es zankte sich alles Volk.'),
      ]),
    ).toEqual([
      '19,9 Da machte sich der König auf und setzte sich ins Tor.',
      '19,10 Und es zankte sich alles Volk.',
    ]);
  });

  it('keeps a number that would lead back as part of the text', () => {
    expect(
      numbered([
        row(1, 1, 5, 'Da ward aus Abend und Morgen der erste Tag (3).'),
      ]),
    ).toEqual(['1,5 Da ward aus Abend und Morgen der erste Tag (3).']);
  });

  it('leaves out verses the translation leaves empty and books beyond Revelation', () => {
    expect(
      numbered([
        row(40, 17, 20, 'Jesus aber antwortete und sprach:'),
        row(
          40,
          17,
          21,
          '- - -<RF>Dieser Vers fehlt in den ältesten Handschriften.<Rf>',
        ),
        row(40, 17, 22, 'Da sie aber ihr Wesen hatten in Galiläa,'),
        row(67, 1, 1, 'Ein Buch der Apokryphen.'),
      ]),
    ).toEqual([
      '17,20 Jesus aber antwortete und sprach:',
      '17,22 Da sie aber ihr Wesen hatten in Galiläa,',
    ]);
  });

  it('sorts books, chapters and verses whatever order the rows come in', () => {
    expect(
      moduleVerses([
        row(2, 1, 1, 'Dies sind die Namen der Kinder Israels.'),
        row(1, 1, 2, 'Und die Erde war wüst und leer.'),
        row(1, 1, 1, 'Am Anfang schuf Gott Himmel und Erde.'),
      ]).map(({ book, verse }) => `${book}:${verse}`),
    ).toEqual(['1:1', '1:2', '2:1']);
  });
});
