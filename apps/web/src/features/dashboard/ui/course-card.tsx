import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import { languageSubtitle } from '../../../shared/languages';

type CourseCardProps = {
  readonly course: {
    readonly id: string;
    readonly name: string;
    readonly targetLanguage: LanguageCode;
  };
  readonly stats:
    | {
        readonly due: number;
        readonly fresh: number;
        readonly unlearned: number;
        readonly words: number;
      }
    | undefined;
  // The course's name as a link into the course itself, which is where
  // everything but today's practice lives.
  readonly courseLink: ReactNode;
  readonly practiceAction: ReactNode;
  readonly importAction: ReactNode;
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
  const due = stats?.due ?? 0;
  const fresh = stats?.fresh ?? 0;
  const unlearned = stats?.unlearned ?? 0;
  const words = stats?.words ?? 0;
  const subtitle = languageSubtitle(course.name, course.targetLanguage);
  return (
    <li className="flex flex-col gap-3 border border-border bg-card p-4">
      <div>
        {courseLink}
        {subtitle === null ? null : (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        )}
      </div>
      {words === 0 ? (
        <p className="text-muted-foreground text-sm">
          Noch keine Wörter – {importAction}.
        </p>
      ) : (
        <p className="flex items-baseline gap-1 text-sm">
          <span className="font-display text-3xl">{due}</span>
          <span>fällig</span>
          <span className="text-muted-foreground">
            · {fresh} neu
            {unlearned > 0 ? ` · ${unlearned} zu lernen` : ''} · {words} Wörter
          </span>
        </p>
      )}
      <div className="mt-auto">{due + fresh > 0 ? practiceAction : null}</div>
    </li>
  );
};
