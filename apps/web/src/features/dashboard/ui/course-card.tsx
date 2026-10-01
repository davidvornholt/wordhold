import type { ReactNode } from 'react';
import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import {
  type CourseNouns,
  type CourseSubject,
  courseNouns,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { languageSubtitle } from '../../../shared/languages';
import { cardCompactClass } from '../../../shared/ui/surface-styles';
import {
  type CourseStats,
  hasAvailablePractice,
} from '../schemas/dashboard-models';

type CourseCardProps = {
  readonly course: CourseSubject & {
    readonly id: string;
    readonly name: string;
  };
  readonly stats: CourseStats | undefined;
  // The course's name as a link into the course itself, which is where
  // everything but today's practice lives.
  readonly courseLink: ReactNode;
  readonly practiceAction: ReactNode;
  readonly learnAction: ReactNode;
  readonly startAction: ReactNode;
};

const courseAction = (
  stats: CourseStats | undefined,
  practiceAction: ReactNode,
  learnAction: ReactNode,
): ReactNode => {
  if (hasAvailablePractice(stats)) {
    return practiceAction;
  }
  return (stats?.unintroduced ?? 0) > 0 ? learnAction : null;
};

const readyDetail = (stats: CourseStats): string =>
  [
    stats.due === 0
      ? null
      : `${countNoun(stats.due, 'Wiederholung', 'Wiederholungen')} fällig`,
    stats.firstReviews === 0
      ? null
      : `${countNoun(stats.firstReviews, 'Karte', 'Karten')} zum ersten Mal`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

const restingDetail = (
  stats: CourseStats,
  nouns: CourseNouns,
): string | null => {
  if (stats.unintroduced > 0) {
    return `Neue ${nouns.plural} verfügbar`;
  }
  return stats.nextDueAt === null
    ? null
    : `Nächster Termin ${formatLearningDateInline(stats.nextDueAt)}`;
};

// What the course holds in memory so far: known entries over all entries,
// as text and as a filled bar that grows as entries become known.
const percentScale = 100;

const KnownMeter = ({
  known,
  entries,
}: Pick<CourseStats, 'known' | 'entries'>) => {
  const percentage =
    entries === 0 ? 0 : Math.round((known / entries) * percentScale);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm">
        <span className="font-medium tabular-nums">{known}</span> von{' '}
        <span className="tabular-nums">{entries}</span> sicher
      </p>
      <div aria-hidden="true" className="h-1.5 w-full bg-border">
        <div
          className="h-full bg-primary transition-[width]"
          // biome-ignore lint/nursery/noInlineStyles: The fill width is data, not a design token.
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const CourseProgress = ({
  stats,
  nouns,
}: {
  readonly stats: CourseStats;
  readonly nouns: CourseNouns;
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      {stats.ready > 0 ? (
        <p className="flex items-baseline gap-2 font-display">
          <span className="text-4xl tabular-nums leading-none">
            {stats.ready}
          </span>
          <span className="text-lg">bereit</span>
        </p>
      ) : (
        <p className="font-display text-lg text-muted-foreground">
          Nichts fällig
        </p>
      )}
      <p className="text-muted-foreground text-sm">
        {stats.ready > 0 ? readyDetail(stats) : restingDetail(stats, nouns)}
      </p>
    </div>
    <KnownMeter entries={stats.entries} known={stats.known} />
  </div>
);

// The card leads with what is ready now, then with how much the course
// already holds. Units and settings stay behind the course name so the
// overview remains readable with several courses on it.
export const CourseCard = ({
  course,
  stats,
  courseLink,
  practiceAction,
  learnAction,
  startAction,
}: CourseCardProps) => {
  const nouns = courseNouns(course);
  // A subject's name says what it is; a language course may need its
  // language spelled out.
  const subtitle =
    course.kind === 'terms'
      ? null
      : languageSubtitle(course.name, course.targetLanguage);
  return (
    <li className={`flex flex-col gap-5 ${cardCompactClass}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {courseLink}
        {subtitle === null ? null : (
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        )}
      </div>
      {stats === undefined || stats.entries === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">
            Noch keine {nouns.plural}.
          </p>
          {startAction}
        </div>
      ) : (
        <CourseProgress nouns={nouns} stats={stats} />
      )}
      <div className="mt-auto">
        {courseAction(stats, practiceAction, learnAction)}
      </div>
    </li>
  );
};
