import { type ReactNode, useId, useState } from 'react';
import { fieldClass } from '../../../shared/ui/field-styles';
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

// Typing words without first opening their book: the place starts at the
// book or unit that received the latest word, so reading one novel means
// picking it once. It sits on the desk above the card, so changing it keeps
// the words filed so far.
export const QuickEntry = ({ outline, renderForm }: QuickEntryProps) => {
  const placeId = useId();
  const options = wordPlaceOptions(outline);
  const [value, setValue] = useState(
    () => lastUsedWordPlace(options)?.value ?? '',
  );
  const selected = options.find((option) => option.value === value);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label className="eyebrow" htmlFor={placeId}>
          Eintragen in
        </label>
        <select
          className={`${fieldClass} sm:max-w-sm`}
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
      {selected === undefined ? null : renderForm(selected.place)}
    </div>
  );
};
