import type { ReactNode } from 'react';
import type { FragileEntry } from '../schemas/dashboard-models';

// The list can mix words from language courses with terms from subjects.
const listedNouns = (entries: ReadonlyArray<FragileEntry>): string => {
  if (entries.every((entry) => entry.courseKind === 'language')) {
    return 'Diese Vokabeln sind';
  }
  return entries.every((entry) => entry.courseKind === 'terms')
    ? 'Diese Begriffe sind'
    : 'Diese Vokabeln und Begriffe sind';
};

export const FragileList = ({
  entries,
  renderEntryAction,
}: {
  readonly entries: ReadonlyArray<FragileEntry>;
  readonly renderEntryAction: (entry: FragileEntry) => ReactNode;
}) =>
  entries.length === 0 ? null : (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Wackelkandidaten</h2>
      <p className="text-muted-foreground text-sm">
        {listedNouns(entries)} zuletzt mehrfach danebengegangen.
      </p>
      <ul className="divide-y divide-border border-border border-y">
        {entries.map((entry) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-2 px-1 py-2 text-sm"
            key={entry.entryId}
          >
            {renderEntryAction(entry)}
            <span className="text-muted-foreground text-xs">
              {entry.courseName} · {entry.failures}× daneben
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
