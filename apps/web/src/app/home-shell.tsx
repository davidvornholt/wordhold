import type { ReactNode } from 'react';
import { Button } from '../shared/ui/button';

type HomeShellProps = {
  readonly user: { readonly name: string } | null;
  // The sign-in controls shown to someone who is not signed in.
  readonly signIn: ReactNode;
  // Links beside the signed-in name, such as the person's passkeys.
  readonly accountLinks: ReactNode;
  readonly onSignOut: () => void;
  readonly children: ReactNode;
};

export const HomeShell = ({
  user,
  signIn,
  accountLinks,
  onSignOut,
  children,
}: HomeShellProps) =>
  user === null ? (
    <main className="page-column flex flex-col items-start gap-6 px-6 py-16">
      <h1
        className="text-balance font-display font-semibold text-4xl sm:text-5xl"
        lang="en"
      >
        From page to memory.
      </h1>
      <p className="max-w-prose text-muted-foreground">
        Fotografiere die Vokabelseiten deines Buchs. Wordhold liest sie aus,
        fragt sie im richtigen Abstand ab und spricht sie dir vor. Melde dich
        an, um deine Sprachen zu sehen.
      </p>
      {signIn}
    </main>
  ) : (
    <main className="page-column flex flex-col gap-10 px-6 py-8">
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-5 text-muted-foreground text-sm">
        <p>Angemeldet als {user.name}</p>
        <div className="flex flex-wrap items-center gap-x-5">
          {accountLinks}
          <Button onClick={onSignOut} variant="quiet-muted">
            Abmelden
          </Button>
        </div>
      </div>
    </main>
  );
