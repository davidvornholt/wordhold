import { type ReactNode, useId, useState } from 'react';
import { fieldCompactClass } from '../../../shared/ui/field-styles';
import type { CourseOutline } from '../schemas/course-units';
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

// Typing a word without first opening its book: the place starts at the book
// or unit that received the latest word, so reading one novel means picking
// it once.
export const QuickEntry = ({ outline, renderForm }: QuickEntryProps) => {
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
      {selected === undefined ? null : renderForm(selected.place)}
    </div>
  );
};
