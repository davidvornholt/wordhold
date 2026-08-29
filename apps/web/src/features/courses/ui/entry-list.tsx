import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { UnitEntry } from '../schemas/course-units';

type EntryListProps = {
  readonly entries: ReadonlyArray<UnitEntry>;
  readonly targetLanguage: LanguageCode;
};

export const EntryList = ({ entries, targetLanguage }: EntryListProps) =>
  entries.length === 0 ? (
    <p className="border border-border bg-card p-6 text-sm">
      In dieser Einheit steht noch keine Vokabel.
    </p>
  ) : (
    // The foreign entry carries its own `lang`, so a screen reader pronounces it
    // in that language instead of reading it as German.
    <ul className="divide-y divide-border border border-border bg-card">
      {entries.map((entry) => (
        <li className="flex flex-col gap-1 px-4 py-3" key={entry.id}>
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-medium" lang={targetLanguage}>
              {entry.targetText}
            </span>
            {entry.learned ? null : (
              <span className="whitespace-nowrap text-muted-foreground text-xs">
                noch nicht gelernt
              </span>
            )}
          </span>
          <span className="text-muted-foreground text-sm">
            {entry.nativeText}
          </span>
        </li>
      ))}
    </ul>
  );
