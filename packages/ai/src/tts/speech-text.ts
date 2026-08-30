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

const escapeSsml = (value: string): string =>
  value
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
  const aliases = aliasesByLanguage[language];
  const matcher = matchers[language];
  const parts: Array<string> = [];
  let cursor = 0;
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
    return { audioProfile: voice, text, textType: 'text', voice };
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
