import { type ReactNode, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { codeStatus, lastActive, personStatus } from '../schemas/people-labels';
import type { Person } from '../schemas/people-models';

export type PersonActions = {
  readonly issueCode: (person: Person) => Promise<void>;
  readonly withdrawCode: (person: Person) => Promise<void>;
  readonly setAccess: (person: Person, enabled: boolean) => Promise<void>;
  readonly remove: (person: Person) => Promise<void>;
};

type PersonRowProps = {
  readonly person: Person;
  readonly actions: PersonActions;
  // The read-only view of the person's languages, subjects and progress.
  readonly inspectLink: ReactNode;
};

// The administrator's own account is managed through GitHub, so their row
// only describes it.
export const PersonRow = ({ person, actions, inspectLink }: PersonRowProps) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-lg">{person.name}</h3>
        <p className="text-muted-foreground text-sm">
          {personStatus(person)} · {lastActive(person)}
        </p>
      </div>
      {person.code === null ? null : (
        <p className="text-sm">{codeStatus(person.code)}</p>
      )}
      {person.admin ? null : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {inspectLink}
          {person.enabled ? (
            <Button
              disabled={busy}
              onClick={() => run(() => actions.issueCode(person))}
              variant="quiet"
            >
              {person.registered
                ? 'Wiederherstellungscode erstellen'
                : 'Neue Einladung erstellen'}
            </Button>
          ) : null}
          {person.code === null ? null : (
            <Button
              disabled={busy}
              onClick={() => run(() => actions.withdrawCode(person))}
              variant="quiet"
            >
              Code zurückziehen
            </Button>
          )}
          <Button
            disabled={busy}
            onClick={() =>
              run(() => actions.setAccess(person, !person.enabled))
            }
            variant="quiet"
          >
            {person.enabled ? 'Zugang sperren' : 'Zugang freigeben'}
          </Button>
          <Button
            className="text-destructive"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
            variant="quiet"
          >
            Löschen
          </Button>
        </div>
      )}
      <output className="text-destructive text-sm">
        {failed
          ? `Die Änderung für ${person.name} wurde nicht gespeichert. Lade die Seite neu und versuche es noch einmal.`
          : null}
      </output>
      <ConfirmDialog
        busy={busy}
        cancelLabel="Abbrechen"
        confirmLabel="Endgültig löschen"
        description={`Das Konto von ${person.name} wird mit allen Sprachen und Fächern, Einträgen, Fotos und Aufnahmen endgültig gelöscht. Die KI-Kosten bleiben in der Übersicht.`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          await run(() => actions.remove(person));
          setConfirmingDelete(false);
        }}
        open={confirmingDelete}
        title={`${person.name} löschen?`}
      />
    </li>
  );
};
