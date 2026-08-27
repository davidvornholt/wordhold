import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { UnitWord } from '../schemas/course-units';

type WordListProps = {
  readonly words: ReadonlyArray<UnitWord>;
  readonly targetLanguage: LanguageCode;
};

export const WordList = ({ words, targetLanguage }: WordListProps) =>
  words.length === 0 ? (
    <p className="border border-border bg-card p-6 text-sm">
      In dieser Einheit steht noch kein Wort.
    </p>
  ) : (
    // The foreign word carries its own `lang`, so a screen reader pronounces it
    // in that language instead of reading it as German.
    <ul className="divide-y divide-border border border-border bg-card">
      {words.map((word) => (
        <li className="flex flex-col gap-1 px-4 py-3" key={word.id}>
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-medium" lang={targetLanguage}>
              {word.targetText}
            </span>
            {word.learned ? null : (
              <span className="whitespace-nowrap text-muted-foreground text-xs">
                noch nicht gelernt
              </span>
            )}
          </span>
          <span className="text-muted-foreground text-sm">
            {word.nativeText}
          </span>
        </li>
      ))}
    </ul>
  );
