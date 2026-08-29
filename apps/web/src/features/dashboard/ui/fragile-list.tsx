import type { ReactNode } from 'react';
import type { FragileEntry } from '../schemas/dashboard-models';

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
        Diese Vokabeln sind zuletzt mehrfach danebengegangen.
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
