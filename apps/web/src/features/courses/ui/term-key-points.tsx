import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { parseKeyPointLines } from './key-point-lines';

type KeyPoints = ReadonlyArray<string>;

type TermKeyPointsProps = {
  // Null until they are derived, here or on the term's first answer.
  readonly keyPoints: KeyPoints | null;
  readonly derive: () => Promise<{ readonly keyPoints: KeyPoints }>;
  readonly update: (
    keyPoints: KeyPoints,
  ) => Promise<{ readonly keyPoints: KeyPoints }>;
};

const focusTargetClass =
  'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2';

const failureMessage = (cause: unknown, fallback: string): string =>
  cause instanceof Error ? cause.message : fallback;

type KeyPointFormProps = {
  readonly initial: KeyPoints;
  readonly save: (keyPoints: KeyPoints) => Promise<void>;
  readonly cancel: () => void;
};

// One key point per line, checked against what grading accepts before it is
// sent.
const KeyPointForm = ({ initial, save, cancel }: KeyPointFormProps) => {
  const [text, setText] = useState(initial.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseKeyPointLines(text);
    if (parsed.kind === 'invalid') {
      setError(parsed.message);
      return;
    }
    setBusy(true);
    setError(null);
    save(parsed.keyPoints).catch((cause: unknown) => {
      setBusy(false);
      setError(
        failureMessage(
          cause,
          'Die Kernpunkte wurden nicht gespeichert. Versuche es noch einmal.',
        ),
      );
    });
  };

  return (
    <form className="grid gap-2" onSubmit={submit}>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Kernpunkte, einer pro Zeile</span>
        <textarea
          // biome-ignore lint/a11y/noAutofocus: The field appears on request; the learner asked to edit, so it takes focus.
          autoFocus={true}
          className={`${fieldOnCardClass} field-sizing-content min-h-24 resize-none`}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          value={text}
        />
      </label>
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={busy} type="submit">
          {busy ? 'Kernpunkte werden gespeichert …' : 'Speichern'}
        </Button>
        <Button disabled={busy} onClick={cancel} variant="quiet-muted">
          Abbrechen
        </Button>
      </div>
    </form>
  );
};

// What a typed definition must contain to count. They are derived from the
// definition once, which can happen here to check them before the first
// answer, and can be written or corrected by hand. Grading always uses the
// current points.
export const TermKeyPoints = ({
  keyPoints,
  derive,
  update,
}: TermKeyPointsProps) => {
  const [changed, setChanged] = useState<KeyPoints | null>(null);
  const [editing, setEditing] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const focusResultRef = useRef(false);
  const current = changed ?? keyPoints;

  // Deriving, saving and cancelling replace the control that had focus, so
  // focus moves to the key points that took its place.
  useEffect(() => {
    if (!(editing || deriving) && focusResultRef.current) {
      focusResultRef.current = false;
      resultRef.current?.focus();
    }
  }, [editing, deriving]);

  const deriveNow = async () => {
    setDeriving(true);
    setError(null);
    try {
      const derived = await derive();
      setChanged(derived.keyPoints);
      focusResultRef.current = true;
    } catch (cause) {
      setError(
        failureMessage(
          cause,
          'Die Kernpunkte konnten nicht bestimmt werden. Versuche es noch einmal oder trage sie selbst ein.',
        ),
      );
    } finally {
      setDeriving(false);
    }
  };

  if (editing) {
    return (
      <KeyPointForm
        cancel={() => {
          focusResultRef.current = true;
          setEditing(false);
        }}
        initial={current ?? []}
        save={async (next) => {
          const saved = await update(next);
          setChanged(saved.keyPoints);
          focusResultRef.current = true;
          setEditing(false);
        }}
      />
    );
  }

  if (current === null) {
    return (
      <div
        className={`flex flex-col items-start gap-1 ${focusTargetClass}`}
        ref={resultRef}
        tabIndex={-1}
      >
        <p className="text-muted-foreground">
          Noch keine Kernpunkte. Sie werden spätestens bei der ersten Abfrage
          bestimmt.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={deriving}
            onClick={() => {
              deriveNow().catch(() => undefined);
            }}
            variant="quiet-muted"
          >
            {deriving ? 'Kernpunkte werden bestimmt …' : 'Kernpunkte bestimmen'}
          </Button>
          <Button
            disabled={deriving}
            onClick={() => setEditing(true)}
            variant="quiet-muted"
          >
            Selbst eintragen
          </Button>
        </div>
        {error === null ? null : (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={`grid gap-1 border-border border-l pl-3 ${focusTargetClass}`}
        ref={resultRef}
        tabIndex={-1}
      >
        <p className="font-medium">Kernpunkte</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          {current.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          Eine Antwort zählt, wenn sie alle Kernpunkte enthält.
        </p>
      </div>
      <Button onClick={() => setEditing(true)} variant="quiet-muted">
        Kernpunkte bearbeiten
      </Button>
    </div>
  );
};
