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
import { useState } from 'react';
import { cardListClass } from '../../../shared/ui/surface-styles';
import type { CourseUnit } from '../schemas/course-units';
import { NewUnitForm } from './new-unit-form';
import { SortableUnitRow } from './sortable-unit-row';

type UnitOrderEditorProps = {
  readonly initialUnits: ReadonlyArray<CourseUnit>;
  readonly createUnit: (name: string) => Promise<ReadonlyArray<CourseUnit>>;
  readonly reorderUnits: (
    unitIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<CourseUnit>>;
};

const screenReaderInstructions = {
  draggable:
    'Drücke die Leertaste, um eine Einheit aufzunehmen. Verschiebe sie mit den Pfeiltasten. Lege sie mit der Leertaste ab oder brich mit Escape ab.',
};

export const UnitOrderEditor = ({
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

  const unitName = (id: string | number): string =>
    units.find((unit) => unit.id === id)?.name ?? 'Einheit';
  const position = (id: string | number): number =>
    units.findIndex((unit) => unit.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `${unitName(active.id)} aufgenommen. Position ${position(active.id)} von ${units.length}.`,
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) =>
      over === null
        ? undefined
        : `${unitName(active.id)} auf Position ${position(over.id)} von ${units.length}.`,
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) =>
      over === null
        ? `${unitName(active.id)} nicht verschoben.`
        : `${unitName(active.id)} auf Position ${position(over.id)} abgelegt.`,
    onDragCancel: ({ active }: { active: { id: string | number } }) =>
      `Verschieben von ${unitName(active.id)} abgebrochen.`,
  };

  const persistOrder = async (
    previous: ReadonlyArray<CourseUnit>,
    next: ReadonlyArray<CourseUnit>,
  ) => {
    setUnits(next);
    setBusy(true);
    setFailed(false);
    setStatus('Reihenfolge wird gespeichert …');
    try {
      setUnits(await reorderUnits(next.map((unit) => unit.id)));
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
      <p className="text-muted-foreground text-sm">
        Ziehe Einheiten in die Reihenfolge des Buchs. Du kannst sie auch mit den
        Pfeiltasten verschieben. Änderungen werden sofort gespeichert.
      </p>
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
          <ul className={cardListClass}>
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
      <NewUnitForm
        busy={busy}
        createUnit={createUnit}
        onBusyChange={setBusy}
        onCreated={setUnits}
        units={units}
      />
      <output
        aria-label="Status der Einheitenverwaltung"
        className={failed ? 'text-destructive text-sm' : 'text-sm'}
      >
        {status}
      </output>
    </div>
  );
};
