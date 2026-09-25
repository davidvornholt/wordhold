import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { maximumUnitNameLength } from '@wordhold/ai/extraction/schema';
import { useState } from 'react';
import { cardListClass } from '../../../shared/ui/surface-styles';
import type { CourseUnit } from '../schemas/course-units';
import { NameForm } from './name-form';
import { SortableUnitRow } from './sortable-unit-row';

type UnitOrderEditorProps = {
  readonly bookName: string;
  readonly initialUnits: ReadonlyArray<CourseUnit>;
  readonly createUnit: (name: string) => Promise<ReadonlyArray<CourseUnit>>;
  readonly reorderUnits: (
    expectedUnitIds: ReadonlyArray<string>,
    unitIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<CourseUnit>>;
};

const screenReaderInstructions = {
  draggable:
    'Drücke die Leertaste, um eine Einheit aufzunehmen. Verschiebe sie mit den Pfeiltasten. Lege sie mit der Leertaste ab oder brich mit Escape ab.',
};

type DragItem = { readonly id: string | number };
type DragMove = {
  readonly active: DragItem;
  readonly over: DragItem | null;
};

const unitAnnouncements = (units: ReadonlyArray<CourseUnit>): Announcements => {
  const unitName = (id: string | number): string =>
    units.find((unit) => unit.id === id)?.name ?? 'Einheit';
  const position = (id: string | number): number =>
    units.findIndex((unit) => unit.id === id) + 1;
  return {
    onDragStart: ({ active }: { readonly active: DragItem }) =>
      `${unitName(active.id)} aufgenommen. Position ${position(active.id)} von ${units.length}.`,
    onDragOver: ({ active, over }: DragMove) =>
      over === null
        ? undefined
        : `${unitName(active.id)} auf Position ${position(over.id)} von ${units.length}.`,
    onDragEnd: ({ active, over }: DragMove) =>
      over === null
        ? `${unitName(active.id)} nicht verschoben.`
        : `${unitName(active.id)} auf Position ${position(over.id)} abgelegt.`,
    onDragCancel: ({ active }: { readonly active: DragItem }) =>
      `Verschieben von ${unitName(active.id)} abgebrochen.`,
  };
};

// Arranges and extends the units of one book. Each book is ordered on its own,
// so a unit never moves into a different book here.
export const UnitOrderEditor = ({
  bookName,
  initialUnits,
  createUnit,
  reorderUnits,
}: UnitOrderEditorProps) => {
  const [units, setUnits] = useState(initialUnits);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const position = (id: string | number): number =>
    units.findIndex((unit) => unit.id === id) + 1;
  const announcements = unitAnnouncements(units);

  const persistOrder = async (
    previous: ReadonlyArray<CourseUnit>,
    next: ReadonlyArray<CourseUnit>,
  ) => {
    setUnits(next);
    setBusy(true);
    setFailed(false);
    setStatus('Reihenfolge wird gespeichert …');
    try {
      setUnits(
        await reorderUnits(
          previous.map((unit) => unit.id),
          next.map((unit) => unit.id),
        ),
      );
      setStatus('Reihenfolge gespeichert.');
    } catch {
      setUnits(previous);
      setFailed(true);
      setStatus(
        'Die Reihenfolge wurde nicht gespeichert. Versuche es noch einmal.',
      );
    } finally {
      setBusy(false);
    }
  };

  const move = async (from: number, to: number) => {
    if (busy || from === to || to < 0 || to >= units.length) {
      return;
    }
    const previous = units;
    await persistOrder(previous, arrayMove([...previous], from, to));
  };

  const finishDrag = ({ active, over }: DragEndEvent) => {
    if (over === null || active.id === over.id) {
      return;
    }
    return move(position(active.id) - 1, position(over.id) - 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <DndContext
        accessibility={{ announcements, screenReaderInstructions }}
        collisionDetection={closestCenter}
        onDragEnd={finishDrag}
        sensors={sensors}
      >
        <SortableContext
          items={units.map((unit) => unit.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul aria-label={`Einheiten in ${bookName}`} className={cardListClass}>
            {units.map((unit, index) => (
              <SortableUnitRow
                busy={busy}
                index={index}
                key={unit.id}
                onMove={move}
                total={units.length}
                unit={unit}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <NameForm
        busy={busy}
        conflict={(name) =>
          units.some((unit) => unit.name === name)
            ? `Die Einheit "${name}" gibt es in diesem Buch bereits.`
            : null
        }
        failedStatus="Die Einheit wurde nicht hinzugefügt. Versuche es noch einmal."
        label="Neue Einheit"
        maxLength={maximumUnitNameLength}
        onBusyChange={setBusy}
        pendingStatus="Einheit wird hinzugefügt …"
        placeholder="z. B. Unité 2 Volet 1"
        save={async (name) => setUnits(await createUnit(name))}
        savedStatus={(name) => `${name} hinzugefügt.`}
        statusLabel={`Status beim Hinzufügen einer Einheit zu ${bookName}`}
        submitLabel="Einheit hinzufügen"
      />
      <output
        aria-label={`Status der Einheiten in ${bookName}`}
        className={failed ? 'text-destructive text-sm' : 'text-sm'}
      >
        {status}
      </output>
    </div>
  );
};
