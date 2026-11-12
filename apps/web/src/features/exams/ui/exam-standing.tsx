import { useOwnerTimeZone } from '../../../shared/dates/owner-time-zone';
import {
  formatShortDate,
  zonedDateFormat,
} from '../../../shared/dates/zoned-format';
import { countNoun } from '../../../shared/format/count';
import { cardClass } from '../../../shared/ui/surface-styles';
import type { ExamReadiness, RoundScore } from '../schemas/exam-models';
import {
  completedRounds,
  type RoundPart,
  roundParts,
  scorePercent,
  scoreText,
  trendText,
} from './exam-figures';

const dayAndMonth = zonedDateFormat({ day: 'numeric', month: 'numeric' });

// One hue for the one series. The bars carry their own labels, and the
// round history below lists the same numbers as text. The plot's top padding
// leaves room for the label of a full bar.
const RoundBars = ({
  rounds,
}: {
  readonly rounds: ReadonlyArray<RoundScore>;
}) => {
  const format = dayAndMonth(useOwnerTimeZone());
  const bars = rounds.map((round) => ({
    id: round.id,
    percent: scorePercent(round),
    date: format.format(round.startedAt),
  }));
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="font-medium text-sm">Richtig je Runde</figcaption>
      <div
        aria-label={`Richtig je Runde: ${bars.map((bar) => `${bar.date} ${bar.percent} %`).join(', ')}`}
        role="img"
      >
        <div
          aria-hidden={true}
          className="flex h-36 items-end gap-2 border-border border-b pt-5"
        >
          {bars.map((bar) => (
            <div
              className="flex h-full max-w-14 flex-1 flex-col justify-end gap-1"
              key={bar.id}
            >
              <span className="text-center text-xs tabular-nums">
                {bar.percent} %
              </span>
              <div
                className="shrink-0 rounded-t-[4px] bg-primary"
                // biome-ignore lint/nursery/noInlineStyles: The bar's height is data, not a design token.
                style={{ height: `${bar.percent}%` }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden={true} className="mt-1.5 flex gap-2">
          {bars.map((bar) => (
            <span
              className="max-w-14 flex-1 text-center text-muted-foreground text-xs tabular-nums"
              key={bar.id}
            >
              {bar.date}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
};

// Right twice is the full green, right only now a paler one, and a wrong
// card a faint grey. Dark mode raises the paler green, which would otherwise
// sink towards the grey on the dark card.
const partColors = {
  'right-twice': 'bg-primary',
  'right-last': 'bg-primary/50 dark:bg-primary/60',
  right: 'bg-primary',
  wrong: 'bg-muted-foreground/20',
} as const satisfies Record<RoundPart['kind'], string>;

const LastRoundBar = ({
  round,
  rightTwice,
}: {
  readonly round: RoundScore;
  readonly rightTwice: number | null;
}) => {
  const parts = roundParts(round, rightTwice);
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="font-medium text-sm">
        Die {countNoun(round.total, 'Karte', 'Karten')} der letzten Runde
      </figcaption>
      <div
        aria-hidden={true}
        className="flex h-4 gap-0.5 overflow-hidden rounded-[4px]"
      >
        {parts
          .filter((part) => part.count > 0)
          .map((part) => (
            <div
              className={partColors[part.kind]}
              key={part.kind}
              // biome-ignore lint/nursery/noInlineStyles: Each segment's share of the bar is data, not a design token.
              style={{ flexBasis: 0, flexGrow: part.count }}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((part) => (
          <li className="flex items-center gap-2" key={part.kind}>
            <span
              aria-hidden={true}
              className={`size-3 shrink-0 rounded-[2px] ${partColors[part.kind]}`}
            />
            {part.count} {part.label}
          </li>
        ))}
      </ul>
    </figure>
  );
};

// The numbers only. Whether that is enough for the test is the learner's
// call, so Wordhold gives no verdict.
export const ExamStanding = ({
  readiness,
  rounds,
}: {
  readonly readiness: ExamReadiness;
  readonly rounds: ReadonlyArray<RoundScore>;
}) => {
  const timeZone = useOwnerTimeZone();
  const { lastRound, previousRound, rightTwice } = readiness;
  if (lastRound === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Sobald du eine Runde abgeschlossen hast, steht hier, wie viele Karten du
        richtig hattest.
      </p>
    );
  }
  const charted = completedRounds(rounds);
  return (
    <div className={`flex flex-col gap-6 ${cardClass}`}>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          Letzte Runde, {formatShortDate(lastRound.startedAt, timeZone)}
        </p>
        <p className="font-display font-semibold text-4xl">
          {scorePercent(lastRound)} %
        </p>
        <p className="text-sm">
          {previousRound === null
            ? scoreText(lastRound)
            : `${scoreText(lastRound)} · ${trendText(lastRound, previousRound)}`}
        </p>
      </div>
      {charted.length < 2 ? null : <RoundBars rounds={charted} />}
      <LastRoundBar rightTwice={rightTwice} round={lastRound} />
      {previousRound === null ? (
        <p className="text-muted-foreground text-sm">
          Nach einer zweiten abgeschlossenen Runde siehst du hier auch, wie sich
          dein Ergebnis entwickelt und welche Karten du zweimal hintereinander
          richtig hattest.
        </p>
      ) : null}
    </div>
  );
};
