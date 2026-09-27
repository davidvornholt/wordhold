import type { LanguageCode } from '@wordhold/db/schema/courses';
import { useId, useState } from 'react';
import type { GeneratedExample } from '../../../shared/examples/example-draft';
import { fieldCompactClass } from '../../../shared/ui/field-styles';
import type { CourseOutline, VocabularyEntry } from '../schemas/course-units';
import type { CreatedVocabularyEntry } from '../services/vocabulary-entry-service';
import { NewVocabularyForm } from './new-vocabulary-form';
import type { NewVocabularyEntryDraft } from './use-new-vocabulary-entry';
import type { WordSide } from './word-pair-fields';
import {
  lastUsedWordPlace,
  type WordPlace,
  wordPlaceOptions,
} from './word-places';

type QuickVocabularyEntryProps = {
  readonly outline: CourseOutline;
  // Every entry of the course, which a typed word is checked against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  readonly createEntry: (
    place: WordPlace,
    draft: NewVocabularyEntryDraft,
  ) => Promise<CreatedVocabularyEntry>;
  readonly suggestTranslation: (
    place: WordPlace,
    text: string,
    given: WordSide,
  ) => Promise<{ readonly translation: string }>;
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
};

// Typing a word without first opening its book: the place starts at the book
// or unit that received the latest word, so reading one novel means picking
// it once.
export const QuickVocabularyEntry = ({
  outline,
  entries,
  targetLabel,
  targetLanguage,
  createEntry,
  suggestTranslation,
  generateExample,
  translateExample,
}: QuickVocabularyEntryProps) => {
  const placeId = useId();
  const options = wordPlaceOptions(outline);
  const [value, setValue] = useState(
    () => lastUsedWordPlace(options)?.value ?? '',
  );
  const selected = options.find((option) => option.value === value);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm" htmlFor={placeId}>
        Eintragen in
        <select
          className={fieldCompactClass}
          id={placeId}
          onChange={(event) => setValue(event.target.value)}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {selected === undefined ? null : (
        <NewVocabularyForm
          createEntry={(draft) => createEntry(selected.place, draft)}
          entries={entries}
          generateExample={generateExample}
          suggestTranslation={(text, given) =>
            suggestTranslation(selected.place, text, given)
          }
          targetLabel={targetLabel}
          targetLanguage={targetLanguage}
          translateExample={translateExample}
        />
      )}
    </div>
  );
};
