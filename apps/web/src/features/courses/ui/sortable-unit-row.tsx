import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import type { CourseUnit } from '../schemas/course-units';

type SortableUnitRowProps = {
  readonly busy: boolean;
  readonly index: number;
  readonly total: number;
  readonly unit: CourseUnit;
  readonly onMove: (from: number, to: number) => void;
};

const Grip = () => (
  <svg
    aria-hidden="true"
    className="size-5"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <circle cx="6" cy="5" r="1.5" />
    <circle cx="14" cy="5" r="1.5" />
    <circle cx="6" cy="10" r="1.5" />
    <circle cx="14" cy="10" r="1.5" />
    <circle cx="6" cy="15" r="1.5" />
    <circle cx="14" cy="15" r="1.5" />
  </svg>
);

export const SortableUnitRow = ({
  busy,
  index,
  total,
  unit,
  onMove,
}: SortableUnitRowProps) => {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: unit.id, disabled: busy });

  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 ${
        isDragging ? 'bg-muted' : 'bg-card'
      }`}
      ref={setNodeRef}
      // biome-ignore lint/nursery/noInlineStyles: dnd-kit computes this transform and transition for every drag frame.
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Button
        {...attributes}
        {...listeners}
        aria-label={`${unit.name} ziehen. Position ${index + 1} von ${total}`}
        className="min-w-11 cursor-grab touch-none active:cursor-grabbing"
        disabled={busy}
        ref={setActivatorNodeRef}
        variant="quiet-muted"
      >
        <Grip />
      </Button>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{unit.name}</span>
        <span className="text-muted-foreground text-sm">
          {countNoun(unit.entries, 'Vokabel', 'Vokabeln')}
        </span>
      </span>
      <Button
        aria-label={`${unit.name} nach oben verschieben`}
        className="min-w-11"
        disabled={busy || index === 0}
        onClick={() => onMove(index, index - 1)}
        variant="quiet-muted"
      >
        ↑
      </Button>
      <Button
        aria-label={`${unit.name} nach unten verschieben`}
        className="min-w-11"
        disabled={busy || index === total - 1}
        onClick={() => onMove(index, index + 1)}
        variant="quiet-muted"
      >
        ↓
      </Button>
    </li>
  );
};
