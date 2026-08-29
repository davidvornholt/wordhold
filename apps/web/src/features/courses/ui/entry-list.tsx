import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { VocabularyEntry } from '../schemas/course-units';
import { VocabularySchedule } from './vocabulary-schedule';

type EntryListProps = {
  readonly entries: ReadonlyArray<VocabularyEntry>;
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
        <li
          className="grid gap-2 px-4 py-3 sm:grid-cols-2 sm:items-start"
          key={entry.id}
        >
          <p>
            <span className="font-medium" lang={targetLanguage}>
              {entry.targetText}
            </span>
            <span className="text-muted-foreground text-sm">
              {' '}
              · {entry.nativeText}
            </span>
          </p>
          <VocabularySchedule entry={entry} targetLanguage={targetLanguage} />
        </li>
      ))}
    </ul>
  );
