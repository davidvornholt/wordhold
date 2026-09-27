import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';
import { wordLocation } from '../../../shared/vocabulary/book-name';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import { matchesFilter } from './vocabulary-filter-logic';
import { type PlaceOption, VocabularyFilters } from './vocabulary-filters';
import { VocabularySelectionBar } from './vocabulary-selection-bar';
import { VocabularyUnitSection } from './vocabulary-unit-section';

type VocabularyLibraryProps = {
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly initialFilter: VocabularyFilter;
  // Course scope only: preselects the book or unit dropdown when arriving via
  // a link.
  readonly initialPlaceId?: string;
  // Course scope groups entries under "book · unit" headings, or the book's
  // name for words directly in a book, with a book and unit dropdown, since
  // two books may each have a unit with the same name. Place scope shows one
  // flat list because every entry lives in the same book or unit.
  readonly scope: 'course' | 'place';
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

const placeOf = (entry: VocabularyEntry): string =>
  entry.unitId ?? entry.bookId;

// One section per unit and one for the words directly in a book, headed
// "book · unit" or the book's name, because two books may each have a unit
// with the same name.
const placeSections = (
  entries: ReadonlyArray<VocabularyEntry>,
): ReadonlyArray<VocabularySection> =>
  [...Map.groupBy(entries, placeOf).values()].map((placeEntries) => {
    const [first] = placeEntries;
    return [
      first === undefined ? '' : wordLocation(first.bookName, first.unitName),
      placeEntries,
    ] as const;
  });

// Each book, followed by its units. Choosing a book shows every word in it.
const placeOptions = (
  entries: ReadonlyArray<VocabularyEntry>,
): ReadonlyArray<PlaceOption> => [
  ...new Map(
    entries.flatMap(
      (entry): ReadonlyArray<PlaceOption> => [
        [entry.bookId, entry.bookName],
        ...(entry.unitId === null || entry.unitName === null
          ? []
          : [
              [
                entry.unitId,
                wordLocation(entry.bookName, entry.unitName),
              ] as const,
            ]),
      ],
    ),
  ).entries(),
];

const isInPlace = (entry: VocabularyEntry, placeId: string): boolean =>
  entry.bookId === placeId || entry.unitId === placeId;

export const VocabularyLibrary = ({
  enabledDirections,
  entries,
  initialFilter,
  initialPlaceId,
  scope,
  targetLanguage,
  renderStudyAction,
  generateExample,
}: VocabularyLibraryProps) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VocabularyFilter>(initialFilter);
  const [placeFilter, setPlaceFilter] = useState(
    initialPlaceId !== undefined &&
      entries.some((entry) => isInPlace(entry, initialPlaceId))
      ? initialPlaceId
      : 'all',
  );
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
  const now = useMemo(() => new Date(), []);
  const visible = entries.filter((entry) => {
    const needle = query.trim().toLocaleLowerCase('de-DE');
    const matchesQuery =
      needle === '' ||
      entry.targetText.toLocaleLowerCase('de-DE').includes(needle) ||
      entry.nativeText.toLocaleLowerCase('de-DE').includes(needle);
    const matchesPlace =
      scope === 'place' ||
      placeFilter === 'all' ||
      isInPlace(entry, placeFilter);
    return (
      matchesQuery &&
      matchesPlace &&
      matchesFilter(entry, enabledDirections, filter, now)
    );
  });
  const sections: ReadonlyArray<VocabularySection> =
    scope === 'course' ? placeSections(visible) : [['Alle auswählen', visible]];
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
        placeSelect={
          scope === 'course'
            ? {
                value: placeFilter,
                options: placeOptions(entries),
                onChange: setPlaceFilter,
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
