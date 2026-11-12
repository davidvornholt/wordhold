import {
  type AnswerDirection,
  answerDirections,
  relationDirections,
  translationDirections,
} from '@wordhold/db/schema/directions';
import { type ReactNode, type SubmitEvent, useId, useState } from 'react';
import {
  type CourseSubject,
  courseNouns,
  directionLabel,
  isListCourse,
} from '../../../shared/directions';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';
import { Checkbox } from '../../../shared/ui/selection-controls';
import { cardCompactClass } from '../../../shared/ui/surface-styles';
import { maximumExamNameLength } from '../schemas/exam-models';
import { failureText, type PickableEntry } from './exam-figures';
import { ExamWordPicker } from './exam-word-picker';

export type ExamDraft = {
  readonly name: string;
  readonly directions: ReadonlyArray<AnswerDirection>;
  readonly entryIds: ReadonlyArray<string>;
};

type ExamFormProps = {
  readonly subject: CourseSubject;
  // The directions the course itself learns, to say when the test asks one
  // whose cards the learning pass leaves out.
  readonly courseDirections: ReadonlyArray<AnswerDirection>;
  readonly entries: ReadonlyArray<PickableEntry>;
  readonly initial: ExamDraft;
  readonly submitLabel: string;
  readonly cancelControl: ReactNode;
  readonly save: (draft: ExamDraft) => Promise<void>;
};

const draftProblem = (
  draft: ExamDraft,
  subject: CourseSubject,
): string | null => {
  if (draft.name.trim().length === 0) {
    return 'Gib dem Test einen Namen.';
  }
  if (draft.directions.length === 0) {
    return 'Wähle mindestens eine Richtung.';
  }
  if (draft.entryIds.length === 0) {
    const noun = courseNouns(subject).singular;
    return subject.kind === 'language'
      ? `Wähle mindestens eine ${noun} aus.`
      : `Wähle mindestens einen ${noun} aus.`;
  }
  return null;
};

// A test names the words it covers and the directions it asks them in. A
// subject or collection asks its one direction.
export const ExamForm = ({
  subject,
  courseDirections,
  entries,
  initial,
  submitLabel,
  cancelControl,
  save,
}: ExamFormProps) => {
  const nameId = useId();
  const [name, setName] = useState(initial.name);
  const [directions, setDirections] = useState(initial.directions);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(initial.entryIds),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // In the course's order, which is also the order a test lists them in.
  const entryIds = entries
    .filter((entry) => selected.has(entry.id))
    .map((entry) => entry.id);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = { name: name.trim(), directions, entryIds };
    const problem = draftProblem(draft, subject);
    if (problem !== null) {
      setStatus(problem);
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await save(draft);
    } catch (cause) {
      setStatus(
        failureText(cause, 'Der Test konnte nicht gespeichert werden.'),
      );
      setSaving(false);
    }
  };

  const buttonLabel = saving ? 'Wird gespeichert …' : submitLabel;

  return (
    <form aria-busy={saving} className="flex flex-col gap-6" onSubmit={submit}>
      <div className="flex flex-col gap-2">
        <label className="font-medium" htmlFor={nameId}>
          Name
        </label>
        <input
          className={fieldClass}
          id={nameId}
          maxLength={maximumExamNameLength}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="Vokabeltest Unité 3"
          value={name}
        />
      </div>
      {isListCourse(subject.kind) ? null : (
        <ExamDirections
          courseDirections={courseDirections}
          onChange={setDirections}
          subject={subject}
          value={directions}
        />
      )}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">
          Abgefragte {courseNouns(subject).plural} ·{' '}
          <span className="font-normal text-muted-foreground text-sm">
            {entryIds.length} ausgewählt
          </span>
        </legend>
        <ExamWordPicker
          entries={entries}
          grouped={!isListCourse(subject.kind)}
          onChange={setSelected}
          selected={selected}
        />
      </fieldset>
      <output aria-live="polite" className="text-destructive text-sm">
        {status}
      </output>
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={saving} type="submit">
          {buttonLabel}
        </Button>
        {cancelControl}
      </div>
    </form>
  );
};

type ExamDirectionsProps = {
  readonly subject: CourseSubject;
  readonly courseDirections: ReadonlyArray<AnswerDirection>;
  readonly value: ReadonlyArray<AnswerDirection>;
  readonly onChange: (directions: ReadonlyArray<AnswerDirection>) => void;
};

// Synonyms and antonyms share one switch, as in the course settings.
const ExamDirections = ({
  subject,
  courseDirections,
  value,
  onChange,
}: ExamDirectionsProps) => {
  const toggle = (switched: ReadonlyArray<AnswerDirection>) =>
    onChange(
      switched.every((direction) => value.includes(direction))
        ? value.filter((direction) => !switched.includes(direction))
        : answerDirections.filter(
            (direction) =>
              switched.includes(direction) || value.includes(direction),
          ),
    );
  const switches = [
    ...translationDirections.map((direction) => ({
      key: direction,
      label: directionLabel(direction, subject),
      directions: [direction],
    })),
    {
      key: 'relations',
      label: 'Synonyme und Gegenteile',
      directions: relationDirections,
    },
  ];
  const notLearned = switches.filter(
    (candidate) =>
      candidate.directions.some((direction) => value.includes(direction)) &&
      !candidate.directions.some((direction) =>
        courseDirections.includes(direction),
      ),
  );
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 font-medium">Abgefragte Richtungen</legend>
      <div className={`flex flex-col gap-1 ${cardCompactClass}`}>
        {switches.map((candidate) => (
          <DirectionOption
            checked={candidate.directions.every((direction) =>
              value.includes(direction),
            )}
            key={candidate.key}
            label={candidate.label}
            onChange={() => toggle(candidate.directions)}
          />
        ))}
      </div>
      {notLearned.length === 0 ? null : (
        <p className="text-muted-foreground text-sm">
          In den Einstellungen ausgeschaltet:{' '}
          {notLearned.map((candidate) => candidate.label).join(', ')}. Neue
          Karten einer ausgeschalteten Richtung lernst du nicht kennen, und eine
          Runde fragt nur Karten ab, die du schon kennengelernt hast.
        </p>
      )}
    </fieldset>
  );
};

const DirectionOption = ({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: () => void;
}) => {
  const id = useId();
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor={id}>
      <Checkbox checked={checked} id={id} onChange={onChange} />
      {label}
    </label>
  );
};
