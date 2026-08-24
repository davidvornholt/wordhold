import type { FragileWord } from '../schemas/dashboard-models';

export const FragileList = ({
  words,
}: {
  readonly words: ReadonlyArray<FragileWord>;
}) =>
  words.length === 0 ? null : (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Wackelkandidaten</h2>
      <p className="text-muted-foreground text-sm">
        Diese Wörter sind zuletzt mehrfach danebengegangen.
      </p>
      <ul className="divide-y divide-border border-border border-y">
        {words.map((word) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-2 px-1 py-2 text-sm"
            key={word.entryId}
          >
            <span>
              <span className="font-medium">{word.targetText}</span> –{' '}
              {word.nativeText}
            </span>
            <span className="text-muted-foreground text-xs">
              {word.courseName} · {word.failures}× daneben
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
