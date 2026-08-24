import { Link } from '@tanstack/react-router';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { germanLabels } from '../languages';

type CourseCardProps = {
  readonly course: {
    readonly id: string;
    readonly name: string;
    readonly targetLanguage: LanguageCode;
  };
  readonly stats:
    | { readonly due: number; readonly fresh: number; readonly words: number }
    | undefined;
};

export const CourseCard = ({ course, stats }: CourseCardProps) => {
  const due = stats?.due ?? 0;
  const fresh = stats?.fresh ?? 0;
  const words = stats?.words ?? 0;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      <div>
        <span className="font-medium">{course.name}</span>
        <p className="text-neutral-500 text-xs">
          {germanLabels[course.targetLanguage]}
        </p>
      </div>
      {words === 0 ? (
        <p className="text-neutral-500 text-sm">
          Noch keine Wörter – fotografiere die erste Seite.
        </p>
      ) : (
        <p className="flex items-baseline gap-1 text-sm">
          <span className="font-semibold text-2xl">{due}</span>
          <span>fällig</span>
          <span className="text-neutral-500">
            · {fresh} neu · {words} Wörter
          </span>
        </p>
      )}
      <div className="mt-auto flex gap-4">
        {due + fresh > 0 ? (
          <Link
            className="font-medium text-sm underline"
            params={{ courseId: course.id }}
            to="/courses/$courseId/practice"
          >
            Üben
          </Link>
        ) : null}
        <Link
          className="text-sm underline"
          params={{ courseId: course.id }}
          to="/courses/$courseId/import"
        >
          Seite fotografieren
        </Link>
      </div>
    </li>
  );
};
