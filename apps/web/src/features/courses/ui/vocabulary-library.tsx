import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';
import { unitLocation } from '../../../shared/vocabulary/book-name';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import { matchesFilter } from './vocabulary-filter-logic';
import { type UnitOptionGroup, VocabularyFilters } from './vocabulary-filters';
import { VocabularySelectionBar } from './vocabulary-selection-bar';
import { VocabularyUnitSection } from './vocabulary-unit-section';

type VocabularyLibraryProps = {
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly initialFilter: VocabularyFilter;
  // Course scope only: preselects the unit dropdown when arriving via a link.
  readonly initialUnitId?: string;
  // Course scope groups entries under "book · unit" headings with a unit
  // dropdown, since two books may each have a unit with the same name; unit
  // scope shows one flat list because every entry belongs to the same unit.
  readonly scope: 'course' | 'unit';
  readonly targetLanguage: LanguageCode;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly generateExample: (
    entryId: string,
  ) => Promise<NonNullable<VocabularyEntry['example']>>;
};

type VocabularySection = readonly [string, ReadonlyArray<VocabularyEntry>];

// One section per unit, headed "book · unit" because two books may each have
// a unit with the same name.
const unitSections = (
  entries: ReadonlyArray<VocabularyEntry>,
): ReadonlyArray<VocabularySection> =>
  [...Map.groupBy(entries, (entry) => entry.unitId).values()].map(
    (unitEntries) => {
      const [first] = unitEntries;
      return [
        first === undefined ? '' : unitLocation(first.bookName, first.unitName),
        unitEntries,
      ] as const;
    },
  );

const unitOptionGroups = (
  entries: ReadonlyArray<VocabularyEntry>,
): ReadonlyArray<UnitOptionGroup> =>
  [...Map.groupBy(entries, (entry) => entry.bookId).values()].map(
    (bookEntries) => ({
      bookName: bookEntries[0]?.bookName ?? '',
      units: [
        ...new Map(
          bookEntries.map((entry) => [entry.unitId, entry.unitName] as const),
        ).entries(),
      ],
    }),
  );

export const VocabularyLibrary = ({
  enabledDirections,
  entries,
  initialFilter,
  initialUnitId,
  scope,
  targetLanguage,
  renderStudyAction,
  generateExample,
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
  const sections: ReadonlyArray<VocabularySection> =
    scope === 'course' ? unitSections(visible) : [['Alle auswählen', visible]];
  const unitOptions = unitOptionGroups(entries);
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
  const selectedEntries = entries.filter((entry) =>
    selected.includes(entry.id),
  );
  const selectionIntent = selectedEntries.every((entry) =>
    entry.cards
      .filter((card) => enabledDirections.includes(card.direction))
      .every((card) => card.introducedAt === null),
  )
    ? 'learn'
    : 'practice';

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
            generateExample={generateExample}
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
          {renderStudyAction(selected, selectionIntent)}
        </VocabularySelectionBar>
      )}
    </div>
  );
};
