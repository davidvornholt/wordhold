import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import { germanLabels } from '../../../shared/languages';

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
  readonly practiceAction: ReactNode;
  readonly learnAction: ReactNode;
  readonly drillAction: ReactNode;
  readonly importAction: ReactNode;
  readonly settingsAction: ReactNode;
};

export const CourseCard = ({
  course,
  stats,
  practiceAction,
  learnAction,
  drillAction,
  importAction,
  settingsAction,
}: CourseCardProps) => {
  const due = stats?.due ?? 0;
  const fresh = stats?.fresh ?? 0;
  const unlearned = stats?.unlearned ?? 0;
  const words = stats?.words ?? 0;
  return (
    <li className="flex flex-col gap-3 border border-border bg-card p-4">
      <div>
        <span className="font-medium">{course.name}</span>
        <p className="text-muted-foreground text-xs">
          {germanLabels[course.targetLanguage]}
        </p>
      </div>
      {words === 0 ? (
        <p className="text-muted-foreground text-sm">
          Noch keine Wörter – fotografiere die erste Seite.
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
      <div className="mt-auto flex flex-wrap gap-4">
        {due + fresh > 0 ? practiceAction : null}
        {unlearned > 0 ? learnAction : null}
        {/* Drilling needs learned words, which is the only thing it asks
            about; whether any of them are due today is beside the point. */}
        {words - unlearned > 0 ? drillAction : null}
        {importAction}
        {settingsAction}
      </div>
    </li>
  );
};
