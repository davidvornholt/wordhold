import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import type { VocabularyEntry } from '../schemas/course-units';
import type { WordPlace, WordPlaceOption } from './word-places';

type MoveFormProps = {
  readonly options: ReadonlyArray<WordPlaceOption>;
  // Resolves to the notice for what was moved.
  readonly move: (option: WordPlaceOption) => Promise<string>;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onMoved: (notice: string) => void;
  readonly onCancel: () => void;
};

// Mounted per opening, so each one starts without a place chosen: moving a
// selection to a place nobody picked would be easy to miss. Focus starts on the
// choice, and returns there when moving failed.
const MoveForm = ({
  options,
  move,
  onBusyChange,
  onMoved,
  onCancel,
}: MoveFormProps) => {
  const fieldId = useId();
  const fieldRef = useRef<HTMLSelectElement>(null);
  const [value, setValue] = useState('');
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((option) => option.value === value);

  useEffect(() => {
    if (!moving) {
      fieldRef.current?.focus();
    }
  }, [moving]);

  const submit = async (option: WordPlaceOption) => {
    setMoving(true);
    setError(null);
    onBusyChange(true);
    try {
      const notice = await move(option);
      onBusyChange(false);
      onMoved(notice);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Das Verschieben hat nicht geklappt. Versuche es noch einmal.',
      );
      setMoving(false);
      onBusyChange(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen !== undefined) {
          submit(chosen).catch(() => undefined);
        }
      }}
    >
      <label className="flex flex-col gap-1" htmlFor={fieldId}>
        Verschieben nach
        <select
          className={fieldOnCardClass}
          disabled={moving}
          id={fieldId}
          onChange={(event) => setValue(event.target.value)}
          ref={fieldRef}
          value={value}
        >
          <option disabled={true} value="">
            Ziel wählen
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error === null ? null : (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={moving || chosen === undefined} type="submit">
          {moving ? 'Wird verschoben …' : 'Verschieben'}
        </Button>
        <Button disabled={moving} onClick={onCancel} variant="quiet">
          Abbrechen
        </Button>
      </div>
    </form>
  );
};

type MoveSelectionDialogProps = {
  readonly open: boolean;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly subject: CourseSubject;
  // The places this selection can go to.
  readonly options: ReadonlyArray<WordPlaceOption>;
  readonly move: (
    entryIds: ReadonlyArray<string>,
    place: WordPlace,
  ) => Promise<number>;
  readonly returnFocusRef: RefObject<HTMLElement | null> | undefined;
  readonly onMoved: (notice: string) => void;
  readonly onClose: () => void;
};

// Moves a selection to another book or unit of the course. Everything learned
// stays with the entries, so nothing needs confirming beyond the place.
export const MoveSelectionDialog = ({
  open,
  entries,
  subject,
  options,
  move,
  returnFocusRef,
  onMoved,
  onClose,
}: MoveSelectionDialogProps) => {
  const [busy, setBusy] = useState(false);
  const nouns = courseNouns(subject);
  return (
    <Dialog
      closable={!busy}
      description={
        <p className="text-muted-foreground">
          Lernstand, Termine und bisherige Antworten bleiben erhalten.
        </p>
      }
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      // Closed, it names no count, since no selection is being moved.
      title={
        open
          ? `${countNoun(entries.length, nouns.singular, nouns.plural)} verschieben`
          : ''
      }
    >
      <MoveForm
        move={async ({ label, place }) => {
          const moved = await move(
            entries.map((entry) => entry.id),
            place,
          );
          return `${countNoun(moved, nouns.singular, nouns.plural)} nach „${label}“ verschoben.`;
        }}
        onBusyChange={setBusy}
        onCancel={onClose}
        onMoved={onMoved}
        options={options}
      />
    </Dialog>
  );
};
