import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type RefObject, useId, useState } from 'react';
import {
  type CourseNouns,
  type CourseSubject,
  courseNouns,
  directionLabel,
  isListCourse,
  isRelationDirection,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import type { VocabularyEntry } from '../schemas/course-units';
import type { CourseEntryActions } from './entry-actions';
import { DirectionSuffix } from './entry-learning-action';
import {
  learningChangeFailure,
  useLearningChange,
} from './use-learning-change';
import {
  learningDirections,
  openLearningCardIds,
} from './vocabulary-schedule-status';

const entryGenitives = {
  language: 'der Vokabel',
  terms: 'des Begriffs',
  texts: 'des Textes',
} as const satisfies Record<CourseSubject['kind'], string>;

const rowStatus = (
  skipped: number,
  open: number,
  total: number,
  nouns: CourseNouns,
): string => {
  if (skipped > 0) {
    return `${countNoun(skipped, nouns.singular, nouns.plural)} übersprungen · bereit für die erste Übung`;
  }
  if (open === 0) {
    return total === 1 ? 'Schon kennengelernt' : 'Alle schon kennengelernt';
  }
  // Some but not all are open, so there are at least two.
  return open === total
    ? `${countNoun(open, nouns.singular, nouns.plural)} noch nicht kennengelernt`
    : `${open} von ${total} ${nouns.dativePlural} noch nicht kennengelernt`;
};

type DirectionRowProps = {
  readonly direction: AnswerDirection;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly subject: CourseSubject;
  // What this sitting of the dialog skipped here, which undo returns.
  readonly skipped: ReadonlyArray<string>;
  readonly actions: CourseEntryActions;
  readonly onSkipped: (cardIds: ReadonlyArray<string>) => void;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onAnnounce: (notice: string) => void;
};

// One direction of the selection: how much of it is still to be learned,
// and the one button that skips it or undoes the skip. The button stays in
// place across both, so focus stays on it.
const DirectionRow = ({
  direction,
  entries,
  subject,
  skipped,
  actions,
  onSkipped,
  onBusyChange,
  onAnnounce,
}: DirectionRowProps) => {
  const headingId = useId();
  const nouns = courseNouns(subject);
  const { busy, failed, buttonRef, run } = useLearningChange(onBusyChange);
  const open = openLearningCardIds(entries, direction);
  const total = entries.filter((entry) =>
    entry.cards.some((card) => card.direction === direction),
  ).length;
  // A subject's only direction needs no name.
  const name = isListCourse(subject.kind)
    ? null
    : directionLabel(direction, subject);
  const suffix = name === null ? '' : ` · ${name}`;
  const undo = skipped.length > 0;

  const skip = () =>
    run(async () => {
      const changed = await actions.skipLearning(open);
      onSkipped(changed);
      onAnnounce(
        `${countNoun(changed.length, nouns.singular, nouns.plural)} übersprungen${suffix}`,
      );
    });
  const restore = () =>
    run(async () => {
      await actions.returnToLearning(skipped);
      onSkipped([]);
      onAnnounce(`Überspringen rückgängig gemacht${suffix}`);
    });

  let label = `${countNoun(open.length, nouns.singular, nouns.plural)} überspringen`;
  if (busy) {
    label = 'Wird gespeichert …';
  } else if (undo) {
    label = 'Rückgängig';
  }

  // Nothing to say about a direction none of these entries has a card in.
  if (total === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby={name === null ? undefined : headingId}
      className="flex flex-col items-start gap-2 border-border border-t pt-4"
    >
      {name === null ? null : (
        <h3 className="font-medium" id={headingId}>
          {name}
        </h3>
      )}
      <p className="text-muted-foreground">
        {rowStatus(skipped.length, open.length, total, nouns)}
      </p>
      {undo || open.length > 0 ? (
        <Button
          disabled={busy}
          onClick={undo ? restore : skip}
          ref={buttonRef}
          variant={undo ? 'quiet' : 'outline'}
        >
          {label}
          <DirectionSuffix direction={name} />
        </Button>
      ) : null}
      {failed ? (
        <p className="text-destructive" role="alert">
          {learningChangeFailure}
        </p>
      ) : null}
    </section>
  );
};

type SkipLearningDialogProps = {
  readonly open: boolean;
  // The selected entries, as the list currently shows them.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly subject: CourseSubject;
  readonly actions: CourseEntryActions;
  // Where focus goes on closing once nothing is left to skip, since the
  // button that opened the dialog is gone by then.
  readonly returnFocusRef: RefObject<HTMLElement | null> | undefined;
  readonly onClose: () => void;
};

// Moves a selection past the learning pass, one direction at a time: what is
// already known in one direction may not be in the other. Each skip can be
// undone here until the dialog closes, and later in each entry's details as
// long as the direction has not been practised.
export const SkipLearningDialog = ({
  open,
  entries,
  enabledDirections,
  subject,
  actions,
  returnFocusRef,
  onClose,
}: SkipLearningDialogProps) => {
  const [skipped, setSkipped] = useState<
    Partial<Record<AnswerDirection, ReadonlyArray<string>>>
  >({});
  const [busy, setBusy] = useState(0);
  const [notice, setNotice] = useState('');
  const nouns = courseNouns(subject);
  const asksRelations = entries.some((entry) =>
    entry.cards.some(
      (card) =>
        isRelationDirection(card.direction) &&
        enabledDirections.includes(card.direction),
    ),
  );
  // Each opening starts over, so undo only ever returns this sitting's skips.
  const close = () => {
    setSkipped({});
    setNotice('');
    onClose();
  };
  return (
    <Dialog
      closable={busy === 0}
      closeLabel="Fertig"
      description={
        <p className="text-muted-foreground">
          Übersprungene {nouns.plural} kommen ohne Kennenlernen direkt in die
          nächste Übung
          {asksRelations ? ', ihre Synonyme und Gegenteile mit ihnen' : ''}.
          Solange eine Richtung noch nicht geübt ist, kannst du sie in den
          Details {entryGenitives[subject.kind]} wieder kennenlernen.
        </p>
      }
      onClose={close}
      open={open}
      returnFocusRef={returnFocusRef}
      title="Kennenlernen überspringen"
    >
      <div className="flex flex-col gap-4 text-sm">
        {learningDirections(enabledDirections).map((direction) => (
          <DirectionRow
            actions={actions}
            direction={direction}
            entries={entries}
            key={direction}
            onAnnounce={setNotice}
            onBusyChange={(rowBusy) =>
              setBusy((count) => count + (rowBusy ? 1 : -1))
            }
            onSkipped={(cardIds) =>
              setSkipped((current) => ({ ...current, [direction]: cardIds }))
            }
            skipped={skipped[direction] ?? []}
            subject={subject}
          />
        ))}
        <output aria-label="Status beim Überspringen" className="sr-only">
          {notice}
        </output>
      </div>
    </Dialog>
  );
};
