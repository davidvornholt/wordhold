import { countNoun } from '../../../shared/format/count';
import type { PracticeDay } from '../schemas/dashboard-models';

// Indexed by Date.getDay(): Sunday first.
const weekdayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

const streakLabel = (streak: number): string =>
  streak === 0
    ? 'Noch keine Serie'
    : `${countNoun(streak, 'Tag', 'Tage')} in Folge`;

const dayClass = (day: PracticeDay, today: boolean): string => {
  const fill = day.practiced
    ? 'border-primary bg-primary'
    : 'border-border bg-card';
  return today ? `${fill} outline-2 outline-offset-2 outline-primary/40` : fill;
};

type WeekStripProps = {
  // Oldest first, today last.
  readonly week: ReadonlyArray<PracticeDay>;
  readonly streak: number;
};

// Seven squares, one per day, filled on days with at least one answer. The
// square is the visual; the visually hidden text names the day and its state.
export const WeekStrip = ({ week, streak }: WeekStripProps) => (
  <div className="flex flex-col gap-2 sm:items-end">
    <ol aria-label="Die letzten sieben Tage" className="flex gap-1.5">
      {week.map((day, index) => {
        const today = index === week.length - 1;
        const label = weekdayLabels[day.weekday] ?? '';
        const description = `${today ? 'Heute' : label}: ${
          day.practiced ? 'geübt' : 'nicht geübt'
        }`;
        return (
          <li className="flex flex-col items-center gap-1.5" key={day.day}>
            <span
              aria-hidden="true"
              className={`block size-6 border transition-colors ${dayClass(day, today)}`}
            />
            <span
              aria-hidden="true"
              className={`text-xs ${today ? 'font-medium' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
            <span className="sr-only">{description}</span>
          </li>
        );
      })}
    </ol>
    <p className="text-sm">{streakLabel(streak)}</p>
  </div>
);
