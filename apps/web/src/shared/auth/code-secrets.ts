const hexRadix = 16;
const hexDigits = 2;
const codeBytes = 32;

// How long an invitation or recovery code can be redeemed.
export const accessCodeLifetimeHours = 24;

// Only the digest is stored, so a database copy cannot be used to sign in.
export const codeDigest = async (code: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code.trim()),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(hexRadix).padStart(hexDigits, '0'),
  ).join('');
};

export const newAccessCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(codeBytes));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
};
