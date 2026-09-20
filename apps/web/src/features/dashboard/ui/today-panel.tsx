import type { ReactNode } from 'react';
import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import { countNoun } from '../../../shared/format/count';
import type { PracticeDay } from '../schemas/dashboard-models';
import { WeekStrip } from './week-strip';

type TodayPanelProps = {
  readonly ready: number;
  readonly reviewsToday: number;
  readonly cardsToday: number;
  readonly nextDueAt: Date | null;
  readonly week: ReadonlyArray<PracticeDay>;
  readonly streak: number;
  // The one primary action of the page, or null when nothing is ready.
  readonly action: ReactNode | null;
};

const restingHeading = (nextDueAt: Date | null): string =>
  nextDueAt === null
    ? 'Noch nichts zu wiederholen'
    : 'Alles für heute wiederholt';

const detailLine = ({
  ready,
  reviewsToday,
  cardsToday,
  nextDueAt,
}: Pick<
  TodayPanelProps,
  'ready' | 'reviewsToday' | 'cardsToday' | 'nextDueAt'
>): string | null => {
  const parts: Array<string> = [];
  if (reviewsToday > 0) {
    parts.push(
      `Heute ${countNoun(cardsToday, 'Karte', 'Karten')} geübt, ${countNoun(
        reviewsToday,
        'Antwort',
        'Antworten',
      )}`,
    );
  }
  if (ready === 0 && nextDueAt !== null) {
    parts.push(`Nächster Termin ${formatLearningDateInline(nextDueAt)}`);
  }
  return parts.length === 0 ? null : parts.join(' · ');
};

// The page opens with today's state as its title: how many cards are ready
// and the one action that starts them, beside the last seven days.
export const TodayPanel = (props: TodayPanelProps) => {
  const { ready, nextDueAt, week, streak, action } = props;
  const detail = detailLine(props);
  return (
    <section className="grid gap-6 border-border border-b pb-8 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="flex flex-col items-start gap-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Heute</p>
          {ready > 0 ? (
            <h1 className="flex flex-wrap items-baseline gap-x-3 font-display">
              <span className="text-6xl tabular-nums leading-none sm:text-7xl">
                {ready}
              </span>
              <span className="text-2xl">
                {ready === 1 ? 'Karte bereit' : 'Karten bereit'}
              </span>
            </h1>
          ) : (
            <h1 className="text-balance font-display text-3xl sm:text-4xl">
              {restingHeading(nextDueAt)}
            </h1>
          )}
          {detail === null ? null : (
            <p className="text-muted-foreground text-sm">{detail}</p>
          )}
        </div>
        {action}
      </div>
      <WeekStrip streak={streak} week={week} />
    </section>
  );
};
