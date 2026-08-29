import type { FragileEntry } from '../schemas/dashboard-models';

export const FragileList = ({
  entries,
}: {
  readonly entries: ReadonlyArray<FragileEntry>;
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
            <span>
              <span className="font-medium">{entry.targetText}</span> –{' '}
              {entry.nativeText}
            </span>
            <span className="text-muted-foreground text-xs">
              {entry.courseName} · {entry.failures}× daneben
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
