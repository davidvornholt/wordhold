import {
  pronunciationDictionary,
  type TtsLanguage,
} from './pronunciation-dictionary';

export type { TtsLanguage } from './pronunciation-dictionary';

const voices: Readonly<Record<TtsLanguage, string>> = {
  de: 'Vicki',
  en: 'Amy',
  es: 'Lucia',
  fr: 'Lea',
};

// Increment this when a dictionary change can alter existing speech.
const pronunciationRevision = 1;
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
  readonly text: string;
  readonly textType: 'ssml' | 'text';
  readonly voice: string;
};

export const prepareSpeechText = (
  text: string,
  language: TtsLanguage,
): PreparedSpeechText => {
  const safeText = removeForbiddenXml10Characters(text);
  const aliases = aliasesByLanguage[language];
  const matcher = matchers[language];
  const parts: Array<string> = [];
  let cursor = 0;
  // Match the imported text before sanitizing it so forbidden characters cannot
  // create a new abbreviation boundary.
  for (const match of text.matchAll(matcher)) {
    const [writtenForm] = match;
    const spokenForm = aliases.get(writtenForm.toLocaleLowerCase());
    if (match.index !== undefined && spokenForm !== undefined) {
      parts.push(escapeSsml(text.slice(cursor, match.index)));
      parts.push(
        `<sub alias="${escapeSsml(spokenForm)}">${escapeSsml(writtenForm)}</sub>`,
      );
      cursor = match.index + writtenForm.length;
    }
  }
  const voice = voices[language];
  if (parts.length === 0) {
    return { audioProfile: voice, text: safeText, textType: 'text', voice };
  }
  parts.push(escapeSsml(text.slice(cursor)));
  return {
    audioProfile: `${voice}-pronunciation-${pronunciationRevision}`,
    text: `<speak>${parts.join('')}</speak>`,
    textType: 'ssml',
    voice,
  };
};

export const ttsAudioProfile = (text: string, language: TtsLanguage): string =>
  prepareSpeechText(text, language).audioProfile;
