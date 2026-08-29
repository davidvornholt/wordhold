import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import { useEffect, useRef, useState } from 'react';
import {
  directionDescription,
  directionLabel,
} from '../../../shared/directions';

type DirectionSettingsProps = {
  readonly initial: ReadonlyArray<AnswerDirection>;
  readonly targetLabel: string;
  readonly save: (
    directions: ReadonlyArray<AnswerDirection>,
  ) => Promise<unknown>;
};

// Which directions this course practises at all. Switching one off hides its
// cards; it never destroys them, so switching it back on carries on where it
// stopped. Each change saves on its own, which is why there is no save button.
// The controls stay locked until that save settles, so the server can never
// receive two snapshots in an order the screen no longer represents.
export const DirectionSettings = ({
  initial,
  targetLabel,
  save,
}: DirectionSettingsProps) => {
  const [directions, setDirections] =
    useState<ReadonlyArray<AnswerDirection>>(initial);
  const restoreFocus = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (saving || restoreFocus.current === null) {
      return;
    }
    restoreFocus.current.focus();
    restoreFocus.current = null;
  }, [saving]);

  const toggle = async (
    direction: AnswerDirection,
    trigger: HTMLInputElement,
  ) => {
    if (saving) {
      return;
    }
    const next = directions.includes(direction)
      ? directions.filter((value) => value !== direction)
      : answerDirections.filter(
          (value) => value === direction || directions.includes(value),
        );
    if (next.length === 0) {
      setStatus('Eine Richtung bleibt immer an, sonst gibt es nichts zu üben.');
      return;
    }
    restoreFocus.current = trigger;
    setDirections(next);
    setSaving(true);
    setStatus('Wird gespeichert …');
    try {
      await save(next);
      setStatus('Gespeichert.');
    } catch (cause) {
      setDirections(directions);
      setStatus(
        `Speichern fehlgeschlagen: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl">
          Welche Richtungen sollen regelmäßig eingeplant werden?
        </h2>
        <p className="text-muted-foreground text-sm">
          Eine ausgeschaltete Richtung erscheint nicht in deinem Lernplan. Ihr
          bisheriger Stand bleibt erhalten und kann beim Einschalten wieder
          fällig sein. In freien Übungen kannst du sie trotzdem wählen.
        </p>
      </div>
      <fieldset
        aria-busy={saving}
        className="flex flex-col gap-4 border border-border bg-card p-4"
        disabled={saving}
      >
        <legend className="sr-only">Regelmäßige Abfragerichtungen</legend>
        {answerDirections.map((direction) => (
          <div className="flex items-start gap-3 text-sm" key={direction}>
            <input
              aria-describedby={`${direction}-description`}
              checked={directions.includes(direction)}
              className="mt-1 accent-primary"
              id={direction}
              onChange={(event) => toggle(direction, event.currentTarget)}
              type="checkbox"
            />
            <span className="flex flex-col gap-0.5">
              <label className="font-medium" htmlFor={direction}>
                {directionLabel(direction, targetLabel)}
              </label>
              <span
                className="text-muted-foreground"
                id={`${direction}-description`}
              >
                {directionDescription(direction, targetLabel)}
              </span>
            </span>
          </div>
        ))}
      </fieldset>
      <output aria-label="Speicherstatus" className="text-sm">
        {status}
      </output>
    </section>
  );
};
