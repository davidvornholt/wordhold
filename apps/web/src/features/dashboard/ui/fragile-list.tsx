import type { ReactNode } from 'react';
import {
  type FragileEntry,
  type FragileGroup,
  fragileActionLabel,
  fragileGroups,
} from '../schemas/dashboard-models';

// The list can mix words from language courses with terms from subjects.
const listedNouns = (entries: ReadonlyArray<FragileEntry>): string => {
  if (entries.every((entry) => entry.courseKind === 'language')) {
    return 'Diese Vokabeln sind';
  }
  return entries.every((entry) => entry.courseKind === 'terms')
    ? 'Diese Begriffe sind'
    : 'Diese Vokabeln und Begriffe sind';
};

// The rows only name the entries; the actions above them practise exactly
// these entries, one sitting per course.
export const FragileList = ({
  entries,
  renderPracticeAction,
}: {
  readonly entries: ReadonlyArray<FragileEntry>;
  readonly renderPracticeAction: (
    group: FragileGroup,
    label: string,
  ) => ReactNode;
}) => {
  if (entries.length === 0) {
    return null;
  }
  const groups = fragileGroups(entries);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Wackelkandidaten</h2>
      <p className="text-muted-foreground text-sm">
        {listedNouns(entries)} zuletzt mehrfach danebengegangen.
      </p>
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <div key={group.courseId}>
            {renderPracticeAction(
              group,
              fragileActionLabel(group, groups.length),
            )}
          </div>
        ))}
      </div>
      <ul className="divide-y divide-border border-border border-y">
        {entries.map((entry) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-2 px-1 py-2 text-sm"
            key={entry.entryId}
          >
            {/* A definition is too long for one row, so terms show alone. */}
            <span>
              <span className="font-medium">{entry.targetText}</span>
              {entry.courseKind === 'terms' ? null : ` · ${entry.nativeText}`}
            </span>
            <span className="text-muted-foreground text-xs">
              {entry.courseName} · {entry.failures}× daneben
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
