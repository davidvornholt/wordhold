export type OwnPasskey = {
  readonly id: string;
  readonly name: string | null;
  readonly createdAt: Date | null;
  // Synced by a password manager rather than bound to one device.
  readonly backedUp: boolean;
};

const day = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Each new passkey is named after the day it was saved, so a list of
// several stays tellable apart.
export const newPasskeyName = (now: Date): string =>
  `Passkey vom ${day.format(now)}`;

export const passkeyStorage = (passkey: Pick<OwnPasskey, 'backedUp'>) =>
  passkey.backedUp
    ? 'Im Passwortmanager gespeichert und auf deinen Geräten verfügbar'
    : 'An ein Gerät oder einen Sicherheitsschlüssel gebunden';
