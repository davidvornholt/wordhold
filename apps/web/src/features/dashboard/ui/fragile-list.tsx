import type { ReactNode } from 'react';
import { courseNouns } from '../../../shared/directions';
import {
  type FragileEntry,
  type FragileGroup,
  fragileActionLabel,
  fragileGroups,
} from '../schemas/dashboard-models';

const nounList = new Intl.ListFormat('de', { type: 'conjunction' });

// The list can mix words from language courses with terms from subjects and
// texts from collections.
const listedNouns = (entries: ReadonlyArray<FragileEntry>): string => {
  const plurals = new Set(
    entries.map((entry) => courseNouns({ kind: entry.courseKind }).plural),
  );
  return `Diese ${nounList.format(plurals)} sind`;
};

// The rows only name the entries; the actions above them practise exactly
// these entries, one sitting per course.
export const FragileList = ({
  entries,
  renderPracticeAction,
}: {
  readonly entries: ReadonlyArray<FragileEntry>;
  // Null where the list is only read, such as in the administrator's view
  // of another person.
  readonly renderPracticeAction:
    | ((group: FragileGroup, label: string) => ReactNode)
    | null;
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
      {renderPracticeAction === null ? null : (
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
      )}
      <ul className="divide-y divide-border border-border border-y">
        {entries.map((entry) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-2 px-1 py-2 text-sm"
            key={entry.entryId}
          >
            {/* A definition or text is too long for one row, so terms and
                texts show alone. */}
            <span>
              <span className="font-medium">{entry.targetText}</span>
              {entry.courseKind === 'language'
                ? ` · ${entry.nativeText}`
                : null}
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
