import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { cardCompactClass } from '../../../shared/ui/surface-styles';
import type { VocabularyFilter } from '../schemas/vocabulary-search';

type UnitSelect = {
  readonly value: string;
  readonly options: ReadonlyArray<readonly [string, string]>;
  readonly onChange: (value: string) => void;
};

type VocabularyFiltersProps = {
  readonly query: string;
  readonly filter: VocabularyFilter;
  readonly onQueryChange: (value: string) => void;
  readonly onFilterChange: (value: VocabularyFilter) => void;
  // The unit's own vocabulary view has no unit to switch, so it omits this.
  readonly unitSelect?: UnitSelect;
};

export const VocabularyFilters = ({
  query,
  filter,
  onQueryChange,
  onFilterChange,
  unitSelect,
}: VocabularyFiltersProps) => (
  <div
    className={`grid gap-3 ${cardCompactClass} ${
      unitSelect === undefined ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
    }`}
  >
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Vokabel suchen</span>
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
    {unitSelect === undefined ? null : (
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Einheit</span>
        <select
          className={fieldOnCardClass}
          onChange={(event) => unitSelect.onChange(event.target.value)}
          value={unitSelect.value}
        >
          <option value="all">Alle Einheiten</option>
          {unitSelect.options.map(([unitId, unitName]) => (
            <option key={unitId} value={unitId}>
              {unitName}
            </option>
          ))}
        </select>
      </label>
    )}
  </div>
);
