import type { RailOutcome } from '../session/rail-outcome';

type CardRailProps = {
  // The part of the round being asked, where naming it says something: a
  // later section, or the after-round. Null otherwise.
  readonly label: string | null;
  // One entry per card in the round, in asking order; null until judged.
  readonly ticks: ReadonlyArray<RailOutcome | null>;
  // The tick of the card being asked now, or null between cards.
  readonly activeIndex: number | null;
  // The verdict on the active card once judged and before it moves on, so
  // its tick fills at the same moment the card does.
  readonly activeOutcome: RailOutcome | null;
  // How far the round has come, short: "3 von 20 · 1 noch einmal". It names
  // the misses too, so the rail never relies on color alone.
  readonly progress: string;
  // The rail in words, read in place of the ticks.
  readonly description: string;
};

const outcomeClass: Record<RailOutcome, string> = {
  correct: 'bg-primary',
  wrong: 'bg-destructive',
  ungraded: 'bg-warning-foreground',
};

// The active tick shows the verdict on its card as soon as there is one. In
// the after-round it already had a color before the card was asked, so it is
// outlined to show which card is being asked.
const tickClass = (
  recorded: RailOutcome | null,
  shown: RailOutcome | null,
  active: boolean,
): string => {
  if (shown === null) {
    return active ? 'bg-foreground/45' : 'bg-border';
  }
  return active && recorded !== null
    ? `${outcomeClass[shown]} outline-1 outline-offset-2 outline-foreground/40`
    : outcomeClass[shown];
};

// One tick per card in the round, filled with its outcome as the round goes
// on, so the row records what happened, not only how far along it is. It
// stays thin and quiet: the card is what the screen is about.
export const CardRail = ({
  label,
  ticks,
  activeIndex,
  activeOutcome,
  progress,
  description,
}: CardRailProps) => (
  <div className="flex flex-col gap-2">
    <p className="sr-only">
      {label === null ? description : `${label}: ${description}`}
    </p>
    <div
      aria-hidden="true"
      className="flex items-baseline justify-between gap-3 text-muted-foreground text-xs tabular-nums"
    >
      <span className="font-medium text-foreground">{label}</span>
      <span>{progress}</span>
    </div>
    <ol aria-hidden="true" className="flex gap-0.5">
      {ticks.map((outcome, index) => {
        const active = index === activeIndex;
        return (
          <li
            className={`h-0.5 flex-1 transition-colors duration-(--motion-slow) ${tickClass(
              outcome,
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
