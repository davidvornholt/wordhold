import type { RailOutcome } from '../session/rail-outcome';

type CardRailProps = {
  readonly label: string;
  readonly total: number;
  // Outcomes of the cards asked so far, in order; the tick after them is the
  // card being asked now.
  readonly outcomes: ReadonlyArray<RailOutcome>;
  // The verdict on the card being asked, once judged and before it moves on,
  // so its tick fills at the same moment the card does.
  readonly current: RailOutcome | null;
  // The spoken form of the rail, kept visible so the state never relies on
  // color alone.
  readonly description: string;
};

const outcomeClass: Record<RailOutcome, string> = {
  correct: 'bg-primary',
  wrong: 'bg-destructive',
  ungraded: 'bg-warning-foreground',
};

const tickClass = (
  outcome: RailOutcome | undefined,
  current: boolean,
): string => {
  if (outcome !== undefined) {
    return outcomeClass[outcome];
  }
  return current ? 'bg-muted-foreground/60' : 'bg-border';
};

// One tick per card in the round, filled with its outcome as the round goes
// on. Replaces a plain progress bar so the row records what happened, not
// only how far along it is.
export const CardRail = ({
  label,
  total,
  outcomes,
  current,
  description,
}: CardRailProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground tabular-nums">{description}</p>
    </div>
    <ol aria-hidden="true" className="flex gap-1">
      {Array.from({ length: total }, (_, index) => (
        <li
          className={`h-1.5 flex-1 transition-colors ${tickClass(
            index === outcomes.length
              ? (current ?? undefined)
              : outcomes[index],
            index === outcomes.length,
          )}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: Ticks are positions in the round; the position is their only identity.
          key={index}
        />
      ))}
    </ol>
  </div>
);
