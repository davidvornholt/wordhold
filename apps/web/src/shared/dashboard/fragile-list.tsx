type FragileWord = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly courseName: string;
  readonly failures: number;
};

export const FragileList = ({
  words,
}: {
  readonly words: ReadonlyArray<FragileWord>;
}) =>
  words.length === 0 ? null : (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-lg">Wackelkandidaten</h2>
      <p className="text-neutral-500 text-sm">
        Diese Wörter sind zuletzt mehrfach danebengegangen.
      </p>
      <ul className="flex flex-col gap-2">
        {words.map((word) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-neutral-200 px-3 py-2 text-sm"
            key={word.entryId}
          >
            <span>
              <span className="font-medium">{word.targetText}</span> –{' '}
              {word.nativeText}
            </span>
            <span className="text-neutral-500 text-xs">
              {word.courseName} · {word.failures}× daneben
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
