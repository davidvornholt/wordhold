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
  readonly importAction: ReactNode;
};

type CourseProgressProps = NonNullable<CourseCardProps['stats']>;

const CourseProgress = (stats: CourseProgressProps) => {
  const { nextDueAt } = stats;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline gap-2">
        <span className="font-display text-3xl">{stats.ready}</span>
        <span>{stats.ready === 1 ? 'Karte bereit' : 'Karten bereit'}</span>
      </p>
      <ul className="text-muted-foreground text-sm">
        <li>
          {stats.due === 0
            ? 'Keine Wiederholung fällig'
            : `${countNoun(stats.due, 'Wiederholung', 'Wiederholungen')} offen`}
        </li>
        <li>
          {stats.firstReviews === 0
            ? 'Keine erste Abfrage offen'
            : `${countNoun(stats.firstReviews, 'erste Abfrage', 'erste Abfragen')} offen`}
        </li>
        {stats.ready === 0 && nextDueAt !== null ? (
          <li>
            Nächster Termin{' '}
            {formatLearningDate(nextDueAt).toLocaleLowerCase('de-DE')}
          </li>
        ) : null}
      </ul>
      <p className="text-muted-foreground text-xs">
        {countNoun(stats.entries, 'Vokabel', 'Vokabeln')} ·{' '}
        {countNoun(
          stats.directions.length,
          'Abfragerichtung',
          'Abfragerichtungen',
        )}
        {stats.unintroduced > 0
          ? ` · ${stats.unintroduced} noch kennenlernen`
          : ''}
      </p>
    </div>
  );
};

// The card answers one question: is there work here today. Units, vocabulary,
// importing and settings all sit one click away behind the course name, so the
// overview stays readable with several courses on it.
export const CourseCard = ({
  course,
  stats,
  courseLink,
  practiceAction,
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
        {hasAvailablePractice(stats) ? practiceAction : null}
      </div>
    </li>
  );
};
