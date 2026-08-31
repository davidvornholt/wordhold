import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import { matchesFilter } from './vocabulary-filter-logic';
import { VocabularyFilters } from './vocabulary-filters';
import { VocabularySelectionBar } from './vocabulary-selection-bar';
import { VocabularyUnitSection } from './vocabulary-unit-section';

type VocabularyLibraryProps = {
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly initialFilter: VocabularyFilter;
  // Course scope only: preselects the unit dropdown when arriving via a link.
  readonly initialUnitId?: string;
  // Course scope groups entries under unit headings with a unit dropdown; unit
  // scope shows one flat list because every entry belongs to the same unit.
  readonly scope: 'course' | 'unit';
  readonly targetLanguage: LanguageCode;
  readonly renderStudyAction: (entryIds: ReadonlyArray<string>) => ReactNode;
};

export const VocabularyLibrary = ({
  enabledDirections,
  entries,
  initialFilter,
  initialUnitId,
  scope,
  targetLanguage,
  renderStudyAction,
}: VocabularyLibraryProps) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VocabularyFilter>(initialFilter);
  const [unitFilter, setUnitFilter] = useState(
    entries.find((entry) => entry.unitId === initialUnitId)?.unitId ?? 'all',
  );
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
  const now = useMemo(() => new Date(), []);
  const visible = entries.filter((entry) => {
    const needle = query.trim().toLocaleLowerCase('de-DE');
    const matchesQuery =
      needle === '' ||
      entry.targetText.toLocaleLowerCase('de-DE').includes(needle) ||
      entry.nativeText.toLocaleLowerCase('de-DE').includes(needle);
    const matchesUnit =
      scope === 'unit' || unitFilter === 'all' || entry.unitId === unitFilter;
    return (
      matchesQuery &&
      matchesUnit &&
      matchesFilter(entry, enabledDirections, filter, now)
    );
  });
  const sections: ReadonlyArray<
    readonly [string, ReadonlyArray<VocabularyEntry>]
  > =
    scope === 'course'
      ? [...Map.groupBy(visible, (entry) => entry.unitName)]
      : [['Alle auswählen', visible]];
  const unitOptions = [
    ...new Map(
      entries.map((entry) => [entry.unitId, entry.unitName] as const),
    ).entries(),
  ];
  const toggleEntry = (entryId: string) =>
    setSelected((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    );
  const toggleAll = (entryIds: ReadonlyArray<string>, select: boolean) =>
    setSelected((current) =>
      select
        ? [...current, ...entryIds.filter((id) => !current.includes(id))]
        : current.filter((id) => !entryIds.includes(id)),
    );

  return (
    <div className="flex flex-col gap-5">
      <VocabularyFilters
        filter={filter}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        query={query}
        unitSelect={
          scope === 'course'
            ? {
                value: unitFilter,
                options: unitOptions,
                onChange: setUnitFilter,
              }
            : undefined
        }
      />
      {filter === 'difficult' && visible.some((entry) => entry.introduced) ? (
        <Button
          className="w-fit"
          onClick={() =>
            setSelected(
              visible
                .filter((entry) => entry.introduced)
                .map((entry) => entry.id),
            )
          }
          variant="outline"
        >
          Schwierige Vokabeln auswählen
        </Button>
      ) : null}
      {visible.length === 0 ? (
        <p className={`${cardClass} text-sm`}>
          Für diese Auswahl wurden keine Vokabeln gefunden.
        </p>
      ) : (
        sections.map(([label, sectionEntries]) => (
          <VocabularyUnitSection
            enabledDirections={enabledDirections}
            entries={sectionEntries}
            key={label}
            label={label}
            labelStyle={scope === 'course' ? 'heading' : 'plain'}
            now={now}
            onToggleAll={toggleAll}
            onToggleEntry={toggleEntry}
            selected={selected}
            targetLanguage={targetLanguage}
          />
        ))
      )}
      {selected.length === 0 ? null : (
        <VocabularySelectionBar count={selected.length}>
          {renderStudyAction(selected)}
        </VocabularySelectionBar>
      )}
    </div>
  );
};
