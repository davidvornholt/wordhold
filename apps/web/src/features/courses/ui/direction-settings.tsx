import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import { useEffect, useRef, useState } from 'react';
import {
  directionDescription,
  directionLabel,
} from '../../../shared/directions';
import { Checkbox } from '../../../shared/ui/selection-controls';
import { cardCompactClass } from '../../../shared/ui/surface-styles';

type DirectionSettingsProps = {
  readonly initial: ReadonlyArray<AnswerDirection>;
  readonly targetLabel: string;
  readonly save: (
    directions: ReadonlyArray<AnswerDirection>,
  ) => Promise<unknown>;
};

// Which directions this course practises at all. Switching one off hides its
// cards without destroying them. Switching it back on resumes learned cards and
// sends untouched ones through the learning pass first. Each change saves on its
// own, which is why there is no save button. The controls stay locked until that
// save settles, so the server cannot receive snapshots out of order.
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
  const [failed, setFailed] = useState(false);

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
      setFailed(false);
      setStatus('Eine Richtung bleibt immer an, sonst gibt es nichts zu üben.');
      return;
    }
    restoreFocus.current = trigger;
    setDirections(next);
    setSaving(true);
    setFailed(false);
    setStatus('Wird gespeichert …');
    try {
      await save(next);
      setStatus('Gespeichert.');
    } catch {
      setDirections(directions);
      setFailed(true);
      setStatus(
        'Speichern fehlgeschlagen. Die Änderung wurde zurückgenommen – versuche es noch einmal.',
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
          bisheriger Stand bleibt erhalten. Beim Einschalten lernst du neue
          Karten dieser Richtung zuerst kennen; bereits gelernte Karten setzen
          ihren Lernplan fort und bleiben für freie Übungen verfügbar.
        </p>
        <p className="text-muted-foreground text-sm">
          Jede Änderung wird sofort gespeichert.
        </p>
      </div>
      <fieldset
        aria-busy={saving}
        className={`flex flex-col gap-4 ${cardCompactClass}`}
        disabled={saving}
      >
        <legend className="sr-only">Regelmäßige Abfragerichtungen</legend>
        {answerDirections.map((direction) => (
          <div className="flex items-start gap-3 text-sm" key={direction}>
            <Checkbox
              aria-describedby={`${direction}-description`}
              checked={directions.includes(direction)}
              className="mt-1"
              id={direction}
              onChange={(event) => toggle(direction, event.currentTarget)}
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
      <output
        aria-label="Speicherstatus"
        className={failed ? 'text-destructive text-sm' : 'text-sm'}
      >
        {status}
      </output>
    </section>
  );
};
