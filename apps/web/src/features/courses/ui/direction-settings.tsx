import {
  type AnswerDirection,
  answerDirections,
  relationDirections,
  translationDirections,
} from '@wordhold/db/schema/directions';
import { useEffect, useId, useRef, useState } from 'react';
import {
  type CourseSubject,
  directionDescription,
  directionLabel,
  isRelationDirection,
} from '../../../shared/directions';
import { germanLabels } from '../../../shared/languages';
import { Checkbox } from '../../../shared/ui/selection-controls';
import { cardCompactClass } from '../../../shared/ui/surface-styles';

type DirectionSettingsProps = {
  readonly initial: ReadonlyArray<AnswerDirection>;
  readonly subject: CourseSubject;
  readonly save: (
    directions: ReadonlyArray<AnswerDirection>,
  ) => Promise<unknown>;
};

// Which directions this course practises at all. Switching one off hides its
// cards without destroying them. Switching it back on resumes learned cards and
// sends untouched ones through the learning pass first. Synonyms and antonyms
// share one switch. Each change saves on its own, which is why there is no
// save button. The controls stay locked until that save settles, so the
// server cannot receive snapshots out of order.
export const DirectionSettings = ({
  initial,
  subject,
  save,
}: DirectionSettingsProps) => {
  const [directions, setDirections] =
    useState<ReadonlyArray<AnswerDirection>>(initial);
  const restoreFocusRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (saving || restoreFocusRef.current === null) {
      return;
    }
    restoreFocusRef.current.focus();
    restoreFocusRef.current = null;
  }, [saving]);

  const toggle = async (
    switched: ReadonlyArray<AnswerDirection>,
    trigger: HTMLInputElement,
  ) => {
    if (saving) {
      return;
    }
    const next = switched.every((direction) => directions.includes(direction))
      ? directions.filter((value) => !switched.includes(value))
      : answerDirections.filter(
          (value) => switched.includes(value) || directions.includes(value),
        );
    if (next.every(isRelationDirection)) {
      setFailed(false);
      setStatus('Eine Übersetzungsrichtung bleibt immer an.');
      return;
    }
    restoreFocusRef.current = trigger;
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
        {translationDirections.map((direction) => (
          <DirectionSwitch
            checked={directions.includes(direction)}
            description={directionDescription(direction, subject)}
            key={direction}
            label={directionLabel(direction, subject)}
            onChange={(trigger) => toggle([direction], trigger)}
          />
        ))}
        <DirectionSwitch
          checked={directions.includes('to_synonym')}
          description={`Du siehst eine Vokabel auf ${germanLabels[subject.targetLanguage]} und schreibst ein Synonym oder ein Gegenteil dazu. Nur Vokabeln, zu denen du Synonyme oder Gegenteile gespeichert hast, bekommen diese Karten.`}
          label="Synonyme und Gegenteile"
          onChange={(trigger) => toggle(relationDirections, trigger)}
        />
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

type DirectionSwitchProps = {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (trigger: HTMLInputElement) => void;
};

const DirectionSwitch = ({
  label,
  description,
  checked,
  onChange,
}: DirectionSwitchProps) => {
  const id = useId();
  return (
    <div className="flex items-start gap-3 text-sm">
      <Checkbox
        aria-describedby={`${id}-description`}
        checked={checked}
        className="mt-1"
        id={id}
        onChange={(event) => onChange(event.currentTarget)}
      />
      <span className="flex flex-col gap-0.5">
        <label className="font-medium" htmlFor={id}>
          {label}
        </label>
        <span className="text-muted-foreground" id={`${id}-description`}>
          {description}
        </span>
      </span>
    </div>
  );
};
