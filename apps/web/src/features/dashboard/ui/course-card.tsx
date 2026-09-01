import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import { formatLearningDate } from '../../../shared/dates/learning-date';
import { countNoun } from '../../../shared/format/count';
import { languageSubtitle } from '../../../shared/languages';
import { cardCompactClass } from '../../../shared/ui/surface-styles';
import {
  type DirectionStats,
  hasAvailablePractice,
} from '../schemas/dashboard-models';

type CourseCardProps = {
  readonly course: {
    readonly id: string;
    readonly name: string;
    readonly targetLanguage: LanguageCode;
  };
  readonly stats:
    | {
        readonly due: number;
        readonly firstReviews: number;
        readonly ready: number;
        readonly unintroduced: number;
        readonly entries: number;
        readonly nextDueAt: Date | null;
        readonly directions: ReadonlyArray<DirectionStats>;
      }
    | undefined;
  // The course's name as a link into the course itself, which is where
  // everything but today's practice lives.
  readonly courseLink: ReactNode;
  readonly practiceAction: ReactNode;
  readonly learnAction: ReactNode;
  readonly importAction: ReactNode;
};

type CourseProgressProps = NonNullable<CourseCardProps['stats']>;

const restingHeading = (stats: CourseProgressProps) =>
  stats.nextDueAt === null
    ? 'Bereit zum Kennenlernen'
    : 'Alles für heute wiederholt';

const courseAction = (
  stats: CourseCardProps['stats'],
  practiceAction: ReactNode,
  learnAction: ReactNode,
): ReactNode => {
  if (hasAvailablePractice(stats)) {
    return practiceAction;
  }
  return (stats?.unintroduced ?? 0) > 0 ? learnAction : null;
};

const CourseProgress = (stats: CourseProgressProps) => {
  const { nextDueAt } = stats;
  return (
    <div className="flex flex-col gap-2">
      {stats.ready > 0 ? (
        <p className="flex items-baseline gap-2">
          <span className="font-display text-3xl">{stats.ready}</span>
          <span>{stats.ready === 1 ? 'Karte bereit' : 'Karten bereit'}</span>
        </p>
      ) : (
        <p className="font-display text-xl">{restingHeading(stats)}</p>
      )}
      <ul className="text-muted-foreground text-sm">
        {stats.due === 0 ? null : (
          <li>
            {countNoun(stats.due, 'Wiederholung', 'Wiederholungen')} fällig
          </li>
        )}
        {stats.firstReviews === 0 ? null : (
          <li>
            {countNoun(stats.firstReviews, 'Karte', 'Karten')} zum ersten Mal{' '}
            üben
          </li>
        )}
        {stats.ready === 0 && nextDueAt !== null ? (
          <li>
            Nächster Termin{' '}
            {formatLearningDate(nextDueAt).toLocaleLowerCase('de-DE')}
          </li>
        ) : null}
        {stats.ready === 0 && stats.unintroduced > 0 ? (
          <li>Neue Vokabeln verfügbar</li>
        ) : null}
      </ul>
      <p className="text-muted-foreground text-xs">
        {countNoun(stats.entries, 'Vokabel', 'Vokabeln')} ·{' '}
        {countNoun(
          stats.directions.length,
          'Abfragerichtung',
          'Abfragerichtungen',
        )}
      </p>
    </div>
  );
};

// The card leads to today's practice first, then to new vocabulary when the
// schedule is resting. Units and settings stay behind the course name so the
// overview remains readable with several courses on it.
export const CourseCard = ({
  course,
  stats,
  courseLink,
  practiceAction,
  learnAction,
  importAction,
}: CourseCardProps) => {
  const subtitle = languageSubtitle(course.name, course.targetLanguage);
  return (
    <li className={`flex flex-col gap-4 ${cardCompactClass}`}>
      <div>
        {courseLink}
        {subtitle === null ? null : (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        )}
      </div>
      {stats === undefined || stats.entries === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">Noch keine Vokabeln.</p>
          {importAction}
        </div>
      ) : (
        <CourseProgress {...stats} />
      )}
      <div className="mt-auto">
        {courseAction(stats, practiceAction, learnAction)}
      </div>
    </li>
  );
};
