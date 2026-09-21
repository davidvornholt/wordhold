import type { RailOutcome } from '../session/rail-outcome';

type CardRailProps = {
  readonly label: string;
  // One entry per card in the round, in asking order; null until judged.
  readonly ticks: ReadonlyArray<RailOutcome | null>;
  // The tick of the card being asked now, or null between cards.
  readonly activeIndex: number | null;
  // The verdict on the active card once judged and before it moves on, so
  // its tick fills at the same moment the card does.
  readonly activeOutcome: RailOutcome | null;
  // The spoken form of the rail, kept visible so the state never relies on
  // color alone.
  readonly description: string;
};

const outcomeClass: Record<RailOutcome, string> = {
  correct: 'bg-primary',
  wrong: 'bg-destructive',
  ungraded: 'bg-warning-foreground',
};

const tickClass = (outcome: RailOutcome | null, active: boolean): string => {
  if (outcome !== null) {
    return active
      ? `${outcomeClass[outcome]} outline-2 outline-offset-2 outline-foreground/30`
      : outcomeClass[outcome];
  }
  return active ? 'bg-muted-foreground/60' : 'bg-border';
};

// One tick per card in the round, filled with its outcome as the round goes
// on. Replaces a plain progress bar so the row records what happened, not
// only how far along it is. In the after-round the active tick is one that
// already has a color, so it is outlined to show which card is being asked.
export const CardRail = ({
  label,
  ticks,
  activeIndex,
  activeOutcome,
  description,
}: CardRailProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground tabular-nums">{description}</p>
    </div>
    <ol aria-hidden="true" className="flex gap-1">
      {ticks.map((outcome, index) => {
        const active = index === activeIndex;
        return (
          <li
            className={`h-1.5 flex-1 transition-colors ${tickClass(
              active ? (activeOutcome ?? outcome) : outcome,
              active,
            )}`}
            // biome-ignore lint/suspicious/noArrayIndexKey: Ticks are positions in the round; the position is their only identity.
            key={index}
          />
        );
      })}
    </ol>
  </div>
);
