const transliterations: ReadonlyMap<string, string> = new Map([
  ['ä', 'ae'],
  ['ö', 'oe'],
  ['ü', 'ue'],
  ['ß', 'ss'],
]);
const idSuffixLength = 6;

// Better Auth requires a unique address, but people sign in with passkeys
// only and are never mailed. Password managers show the address beside a
// passkey added later from the passkeys page, so it carries the name.
export const placeholderEmail = (name: string, userId: string): string => {
  const local = name
    .toLowerCase()
    .replaceAll(/[äöüß]/gu, (letter) => transliterations.get(letter) ?? '')
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '');
  return `${local === '' ? 'person' : local}.${userId.slice(0, idSuffixLength)}@wordhold.invalid`;
};
