import {
  pronunciationDictionary,
  type TtsLanguage,
} from './pronunciation-dictionary';

export type { TtsLanguage } from './pronunciation-dictionary';

const speechProfiles = {
  de: { languageCode: 'de-DE', voice: 'Vicki' },
  en: { languageCode: 'en-US', voice: 'Stephen' },
  es: { languageCode: 'es-ES', voice: 'Sergio' },
  fr: { languageCode: 'fr-FR', voice: 'Remi' },
} as const satisfies Readonly<
  Record<
    TtsLanguage,
    {
      readonly languageCode: string;
      readonly voice: string;
    }
  >
>;

const speechEngine = 'generative' as const;
const slashPauseMilliseconds = 25;
const slashPauseTag = `<break time="${slashPauseMilliseconds}ms"/>`;
// Textbook notation between two spoken parts: "gaming -> game" (word
// family), "= a definition", "ask <-> explain" (opposites), "→ organiser qc"
// (derivation). Read aloud these symbols come out as "minus greater than";
// a pause says the same thing without words.
const notationPauseMilliseconds = 400;
const notationPauseTag = `<break time="${notationPauseMilliseconds}ms"/>`;
const notationSeparator = /\s*(?:<->|<=>|->|<-|=|→|↔|←)\s*/u;
// Cross-language notes label each part with a language letter: "E violence
// F la violence", "F le ciel L caelum". The letters are read as notation, so
// they become pauses too. A note starts with a marker and uses at least two
// different ones; an English sentence like "I liked the countries I visited"
// repeats one letter and stays as it is.
const languageMarkers = new Set([
  'D',
  'E',
  'F',
  'G',
  'I',
  'L',
  'N',
  'P',
  'R',
  'S',
]);
const languageMarkerPattern = /(?:^|\s)(?<letter>[A-Z])\s+(?=\S)/gu;
const leadingMarkerPattern = /^[A-Z]\s/u;

const isLanguageNote = (text: string): boolean => {
  if (!leadingMarkerPattern.test(text)) {
    return false;
  }
  const letters = [...text.matchAll(languageMarkerPattern)]
    .map((match) => match.groups?.letter ?? '')
    .filter((letter) => languageMarkers.has(letter));
  return new Set(letters).size >= 2;
};

const replaceLanguageMarkers = (text: string): string =>
  isLanguageNote(text)
    ? text
        .replace(languageMarkerPattern, (match, letter: string) =>
          languageMarkers.has(letter) ? ' → ' : match,
        )
        .trim()
    : text;
type SpeechProfile = (typeof speechProfiles)[TtsLanguage];

// Increment this when a dictionary change can alter existing speech.
const pronunciationRevision = 2;
const wordCharacterPattern = String.raw`\p{L}\p{N}`;
const wordCharacter = new RegExp(`[${wordCharacterPattern}]`, 'u');
const abbreviationMarkers = new Set(['ª', 'º', '°']);

const requiresWordBoundary = (character: string): boolean =>
  wordCharacter.test(character) && !abbreviationMarkers.has(character);

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const abbreviationPattern = (writtenForm: string): string => {
  const leftBoundary = requiresWordBoundary(writtenForm.at(0) ?? '')
    ? `(?<![${wordCharacterPattern}])`
    : '';
  const rightBoundary = requiresWordBoundary(writtenForm.at(-1) ?? '')
    ? `(?![${wordCharacterPattern}])`
    : '';
  return `${leftBoundary}${escapeRegularExpression(writtenForm)}${rightBoundary}`;
};

const xml10Tab = 0x9;
const xml10LineFeed = 0xa;
const xml10CarriageReturn = 0xd;
const xml10BasicPlaneStart = 0x20;
const xml10BasicPlaneEnd = 0xd7_ff;
const xml10PrivateUseStart = 0xe0_00;
const xml10PrivateUseEnd = 0xff_fd;
const xml10SupplementaryStart = 0x1_00_00;
const xml10SupplementaryEnd = 0x10_ff_ff;

const isAllowedXml10CodePoint = (codePoint: number): boolean =>
  codePoint === xml10Tab ||
  codePoint === xml10LineFeed ||
  codePoint === xml10CarriageReturn ||
  (codePoint >= xml10BasicPlaneStart && codePoint <= xml10BasicPlaneEnd) ||
  (codePoint >= xml10PrivateUseStart && codePoint <= xml10PrivateUseEnd) ||
  (codePoint >= xml10SupplementaryStart && codePoint <= xml10SupplementaryEnd);

const removeForbiddenXml10Characters = (value: string): string =>
  Array.from(value)
    .map((character) =>
      isAllowedXml10CodePoint(character.codePointAt(0) ?? 0) ? character : ' ',
    )
    .join('');

const escapeSsml = (value: string): string =>
  removeForbiddenXml10Characters(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

type LiteralText = {
  readonly text: string;
  readonly usesSlashPause: boolean;
  readonly usesNotationPause: boolean;
};

const prepareSlashText = (value: string): LiteralText => {
  const segments = value.split('/');
  return {
    text: segments.map(escapeSsml).join(slashPauseTag),
    usesSlashPause: segments.length > 1,
    usesNotationPause: false,
  };
};

// A notation symbol at the very start or end has nothing to separate, so it
// disappears without a pause ("= a definition" is read as the definition).
// A literal fragment beside an alias still has speech on that side.
const prepareLiteralText = (
  value: string,
  atStart: boolean,
  atEnd: boolean,
): LiteralText => {
  const parts = value
    .split(notationSeparator)
    .filter(
      (segment, index, segments) =>
        segment.trim() !== '' ||
        (index === 0 && !atStart) ||
        (index === segments.length - 1 && !atEnd),
    )
    .map(prepareSlashText);
  const usesNotationPause = notationSeparator.test(value);
  return {
    text: parts.map((part) => part.text).join(` ${notationPauseTag} `),
    usesSlashPause: parts.some((part) => part.usesSlashPause),
    usesNotationPause,
  };
};

const aliasesFor = (language: TtsLanguage): ReadonlyMap<string, string> =>
  new Map(
    pronunciationDictionary[language].flatMap(([spokenForm, writtenForms]) =>
      writtenForms.map((writtenForm) => [
        writtenForm.toLocaleLowerCase(),
        spokenForm,
      ]),
    ),
  );

const aliasesByLanguage: Readonly<
  Record<TtsLanguage, ReadonlyMap<string, string>>
> = {
  de: aliasesFor('de'),
  en: aliasesFor('en'),
  es: aliasesFor('es'),
  fr: aliasesFor('fr'),
};

const matcherFor = (language: TtsLanguage): RegExp =>
  new RegExp(
    `(?:${[...aliasesByLanguage[language].keys()]
      .sort((left, right) => right.length - left.length)
      .map(abbreviationPattern)
      .join('|')})`,
    'giu',
  );

const matchers: Readonly<Record<TtsLanguage, RegExp>> = {
  de: matcherFor('de'),
  en: matcherFor('en'),
  es: matcherFor('es'),
  fr: matcherFor('fr'),
};

export type PreparedSpeechText = {
  readonly audioProfile: string;
  readonly engine: typeof speechEngine;
  readonly languageCode: SpeechProfile['languageCode'];
  readonly text: string;
  readonly textType: 'ssml' | 'text';
  readonly voice: SpeechProfile['voice'];
};

export const prepareSpeechText = (
  source: string,
  language: TtsLanguage,
): PreparedSpeechText => {
  const text = replaceLanguageMarkers(source);
  const safeText = removeForbiddenXml10Characters(text);
  const aliases = aliasesByLanguage[language];
  const matcher = matchers[language];
  const profile = speechProfiles[language];
  const parts: Array<string> = [];
  let cursor = 0;
  let usesPronunciation = false;
  let usesSlashPause = false;
  let usesNotationPause = false;
  const pushLiteralText = (end: number): void => {
    const literal = prepareLiteralText(
      text.slice(cursor, end),
      cursor === 0,
      end === text.length,
    );
    parts.push(literal.text);
    usesSlashPause ||= literal.usesSlashPause;
    usesNotationPause ||= literal.usesNotationPause;
  };
  // Match the imported text before sanitizing it so forbidden characters cannot
  // create a new abbreviation boundary.
  for (const match of text.matchAll(matcher)) {
    const [writtenForm] = match;
    const spokenForm = aliases.get(writtenForm.toLocaleLowerCase());
    if (match.index !== undefined && spokenForm !== undefined) {
      pushLiteralText(match.index);
      parts.push(
        `<sub alias="${escapeSsml(spokenForm)}">${escapeSsml(writtenForm)}</sub>`,
      );
      usesPronunciation = true;
      cursor = match.index + writtenForm.length;
    }
  }
  pushLiteralText(text.length);

  const baseAudioProfile = `${profile.voice}-${speechEngine}`;
  const audioProfile = [
    baseAudioProfile,
    usesPronunciation ? `pronunciation-${pronunciationRevision}` : undefined,
    usesSlashPause ? `slash-pause-${slashPauseMilliseconds}ms` : undefined,
    usesNotationPause
      ? `notation-pause-${notationPauseMilliseconds}ms`
      : undefined,
  ]
    .filter((part) => part !== undefined)
    .join('-');
  const shared = {
    audioProfile,
    engine: speechEngine,
    languageCode: profile.languageCode,
    voice: profile.voice,
  };
  if (!(usesPronunciation || usesSlashPause || usesNotationPause)) {
    return { ...shared, text: safeText, textType: 'text' };
  }
  return {
    ...shared,
    text: `<speak>${parts.join('')}</speak>`,
    textType: 'ssml',
  };
};

export const ttsAudioProfile = (text: string, language: TtsLanguage): string =>
  prepareSpeechText(text, language).audioProfile;
