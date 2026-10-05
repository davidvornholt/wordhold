import { type SubmitEvent, useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import {
  cardCompactClass,
  cardListClass,
} from '../../../shared/ui/surface-styles';
import type { BibleSummary } from '../schemas/bible-models';

type BibleLibraryProps = {
  readonly bibles: ReadonlyArray<BibleSummary>;
  readonly upload: (file: File) => Promise<BibleSummary>;
  readonly remove: (bibleId: string) => Promise<void>;
};

const verseCount = (count: number) =>
  `${count.toLocaleString('de-DE')} ${count === 1 ? 'Vers' : 'Verse'}`;

const failure = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message !== '' ? cause.message : fallback;

type Status = {
  readonly text: string;
  readonly failed: boolean;
};

const noStatus: Status = { text: '', failed: false };

// The Bibles a person uploaded, to look up texts in any of their
// collections. Each is private to them; nobody else can read it.
export const BibleLibrary = ({ bibles, upload, remove }: BibleLibraryProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(noStatus);
  const [removing, setRemoving] = useState<BibleSummary | null>(null);
  const headingId = useId();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file === null) {
      return;
    }
    const form = event.currentTarget;
    setBusy(true);
    setStatus({ text: `${file.name} wird hochgeladen …`, failed: false });
    try {
      const bible = await upload(file);
      form.reset();
      setFile(null);
      setStatus({
        text: `${bible.abbreviation} hochgeladen: ${verseCount(bible.verseCount)}.`,
        failed: false,
      });
    } catch (cause) {
      setStatus({
        text: failure(
          cause,
          'Die Bibel wurde nicht hochgeladen. Versuche es noch einmal.',
        ),
        failed: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmRemoval = async () => {
    if (removing === null) {
      return;
    }
    setBusy(true);
    try {
      await remove(removing.id);
      setStatus({ text: `${removing.abbreviation} entfernt.`, failed: false });
    } catch (cause) {
      setStatus({
        text: failure(
          cause,
          `${removing.abbreviation} wurde nicht entfernt. Versuche es noch einmal.`,
        ),
        failed: true,
      });
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="font-display text-xl" id={headingId}>
        Bibeln
      </h2>
      <p className="max-w-prose text-muted-foreground text-sm">
        Mit einer Bibel schlägst du Bibelstellen nach, statt sie abzuschreiben:
        Schreib beim Eintragen die Stelle als Titel, zum Beispiel „Joh 3,16“,
        und Wordhold setzt den Text ein. Lade dafür eine Bibel im MySword-Format
        hoch, deren Dateiname auf „.bbl.mybible“ endet. Deine Bibeln gelten für
        alle deine Sammlungen und nur du kannst sie lesen.
      </p>
      {bibles.length === 0 ? null : (
        <ul className={cardListClass}>
          {bibles.map((bible) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              key={bible.id}
            >
              <span className="flex flex-col gap-1">
                <span>{bible.abbreviation}</span>
                <span className="text-muted-foreground text-sm">
                  {bible.name === bible.abbreviation
                    ? verseCount(bible.verseCount)
                    : `${bible.name} · ${verseCount(bible.verseCount)}`}
                </span>
              </span>
              <Button
                aria-label={`${bible.abbreviation} entfernen`}
                disabled={busy}
                onClick={() => setRemoving(bible)}
                variant="quiet"
              >
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        aria-busy={busy}
        className={`${cardCompactClass} flex flex-col gap-3`}
        onSubmit={submit}
      >
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Bibel im MySword-Format</span>
          <input
            className="text-base file:mr-3 file:min-h-11 file:border file:border-input file:bg-background file:px-4 file:py-2 file:text-sm"
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={busy || file === null} type="submit">
            Hochladen
          </Button>
          <output
            aria-label="Status beim Hochladen und Entfernen von Bibeln"
            className={status.failed ? 'text-destructive text-sm' : 'text-sm'}
          >
            {status.text}
          </output>
        </div>
      </form>
      <ConfirmDialog
        busy={busy}
        cancelLabel="Abbrechen"
        confirmLabel="Entfernen"
        description="Die Bibel wird gelöscht. Texte, die du aus ihr eingetragen hast, bleiben in deinen Sammlungen."
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          confirmRemoval().catch(() => undefined);
        }}
        open={removing !== null}
        title={`${removing?.abbreviation ?? 'Bibel'} entfernen?`}
      />
    </section>
  );
};
