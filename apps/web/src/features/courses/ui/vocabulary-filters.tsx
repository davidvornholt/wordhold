import type { VocabularyFilter } from '../schemas/vocabulary-search';

type VocabularyFiltersProps = {
  readonly query: string;
  readonly filter: VocabularyFilter;
  readonly unitFilter: string;
  readonly unitOptions: ReadonlyArray<readonly [string, string]>;
  readonly onQueryChange: (value: string) => void;
  readonly onFilterChange: (value: VocabularyFilter) => void;
  readonly onUnitChange: (value: string) => void;
};

export const VocabularyFilters = ({
  query,
  filter,
  unitFilter,
  unitOptions,
  onQueryChange,
  onFilterChange,
  onUnitChange,
}: VocabularyFiltersProps) => (
  <div className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-3">
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Vokabel suchen</span>
      <input
        className="min-h-11 border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        onChange={(event) => onQueryChange(event.target.value)}
        type="search"
        value={query}
      />
    </label>
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Anzeigen</span>
      <select
        className="min-h-11 border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-2"
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Unit</span>
      <select
        className="min-h-11 border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        onChange={(event) => onUnitChange(event.target.value)}
        value={unitFilter}
      >
        <option value="all">Alle Units</option>
        {unitOptions.map(([unitId, unitName]) => (
          <option key={unitId} value={unitId}>
            {unitName}
          </option>
        ))}
      </select>
    </label>
  </div>
);
