import { type ReactNode, useId, useState } from 'react';
import { entryChoiceLineClass } from '../../../shared/ui/field-styles';
import type { CourseOutline } from '../schemas/course-units';
import { EntryPlaceContext } from './entry-dialog-context';
import {
  lastUsedWordPlace,
  type WordPlace,
  wordPlaceOptions,
} from './word-places';

type QuickEntryProps = {
  readonly outline: CourseOutline;
  // The form for a word, saving into the chosen place.
  readonly renderForm: (place: WordPlace) => ReactNode;
};

// Typing words without first opening their book: the place starts at the
// book or unit that received the latest word, so reading one novel means
// picking it once. It sits on the card under its title, and changing it
// keeps the words filed so far, as the form stays mounted.
export const QuickEntry = ({ outline, renderForm }: QuickEntryProps) => {
  const placeId = useId();
  const options = wordPlaceOptions(outline);
  const [value, setValue] = useState(
    () => lastUsedWordPlace(options)?.value ?? '',
  );
  const selected = options.find((option) => option.value === value);
  if (selected === undefined) {
    return null;
  }
  return (
    <EntryPlaceContext
      value={
        <div className="flex flex-wrap items-baseline gap-x-3">
          <label className="eyebrow" htmlFor={placeId}>
            Eintragen in
          </label>
          <select
            className={`${entryChoiceLineClass} min-w-0 max-w-full sm:max-w-sm`}
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
        </div>
      }
    >
      {renderForm(selected.place)}
    </EntryPlaceContext>
  );
};
