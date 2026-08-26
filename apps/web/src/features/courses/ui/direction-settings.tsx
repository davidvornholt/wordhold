import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import { useState } from 'react';
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
export const DirectionSettings = ({
  initial,
  targetLabel,
  save,
}: DirectionSettingsProps) => {
  const [directions, setDirections] =
    useState<ReadonlyArray<AnswerDirection>>(initial);
  const [status, setStatus] = useState('');

  const toggle = async (direction: AnswerDirection) => {
    const next = directions.includes(direction)
      ? directions.filter((value) => value !== direction)
      : answerDirections.filter(
          (value) => value === direction || directions.includes(value),
        );
    if (next.length === 0) {
      setStatus('Eine Richtung bleibt immer an, sonst gibt es nichts zu üben.');
      return;
    }
    setDirections(next);
    setStatus('Wird gespeichert …');
    try {
      await save(next);
      setStatus('Gespeichert.');
    } catch (cause) {
      setDirections(directions);
      setStatus(
        `Speichern fehlgeschlagen: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-4 border border-border bg-card p-4">
        <legend className="px-1 font-medium">Abfragerichtungen</legend>
        {answerDirections.map((direction) => (
          <div className="flex items-start gap-3 text-sm" key={direction}>
            <input
              aria-describedby={`${direction}-description`}
              checked={directions.includes(direction)}
              className="mt-1 accent-primary"
              id={direction}
              onChange={() => toggle(direction)}
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
      <output className="text-sm">{status}</output>
    </section>
  );
};
