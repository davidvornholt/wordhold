import type { CourseNouns } from '../../../shared/directions';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { cardCompactClass } from '../../../shared/ui/surface-styles';
import type { VocabularyFilter } from '../schemas/vocabulary-search';

// A book or unit id with the label it is listed under.
export type PlaceOption = readonly [string, string];

type PlaceSelect = {
  readonly value: string;
  readonly options: ReadonlyArray<PlaceOption>;
  readonly onChange: (value: string) => void;
};

type VocabularyFiltersProps = {
  readonly query: string;
  readonly filter: VocabularyFilter;
  readonly nouns: CourseNouns;
  readonly onQueryChange: (value: string) => void;
  readonly onFilterChange: (value: VocabularyFilter) => void;
  // A book's or unit's own vocabulary view has nothing to switch, so it omits
  // this.
  readonly placeSelect?: PlaceSelect;
};

export const VocabularyFilters = ({
  query,
  filter,
  nouns,
  onQueryChange,
  onFilterChange,
  placeSelect,
}: VocabularyFiltersProps) => (
  <div
    className={`grid gap-3 ${cardCompactClass} ${
      placeSelect === undefined ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
    }`}
  >
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{nouns.singular} suchen</span>
      <input
        className={fieldOnCardClass}
        onChange={(event) => onQueryChange(event.target.value)}
        type="search"
        value={query}
      />
    </label>
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Anzeigen</span>
      <select
        className={fieldOnCardClass}
        onChange={(event) =>
          onFilterChange(event.target.value as VocabularyFilter)
        }
        value={filter}
      >
        <option value="all">Alle</option>
        <option value="due">Jetzt fällig</option>
        <option value="first-reviews">Erste Abfrage</option>
        <option value="difficult">Schwierig</option>
      </select>
    </label>
    {placeSelect === undefined ? null : (
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Buch oder Einheit</span>
        <select
          className={fieldOnCardClass}
          onChange={(event) => placeSelect.onChange(event.target.value)}
          value={placeSelect.value}
        >
          <option value="all">Alle</option>
          {placeSelect.options.map(([placeId, label]) => (
            <option key={placeId} value={placeId}>
              {label}
            </option>
          ))}
        </select>
      </label>
    )}
  </div>
);
