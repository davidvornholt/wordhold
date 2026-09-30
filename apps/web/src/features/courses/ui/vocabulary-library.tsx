import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode, RefObject } from 'react';
import { useMemo, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';
import { wordLocation } from '../../../shared/vocabulary/book-name';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import type { CourseEntryActions } from './entry-actions';
import { VocabularyEntryDialog } from './vocabulary-entry-details';
import { matchesFilter } from './vocabulary-filter-logic';
import { type PlaceOption, VocabularyFilters } from './vocabulary-filters';
import { VocabularySelectionBar } from './vocabulary-selection-bar';
import { VocabularyUnitSection } from './vocabulary-unit-section';

type VocabularyLibraryProps = {
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly initialFilter: VocabularyFilter;
  // By place only: preselects the book or unit dropdown when arriving via a
  // link.
  readonly initialPlaceId?: string;
  // A language course's whole list groups entries under "book · unit"
  // headings, or the book's name for words directly in a book, with a book
  // and unit dropdown, since two books may each have a unit with the same
  // name. A book's or unit's own list, and a subject's list of terms, is one
  // flat list.
  readonly layout: 'by-place' | 'flat';
  readonly subject: CourseSubject;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly entryActions: CourseEntryActions;
  // Where focus goes when an entry's dialog closes and its row is gone:
  // deleted, or corrected so it no longer matches the search.
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
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

const matchesQuery = (entry: VocabularyEntry, query: string): boolean => {
  const needle = query.trim().toLocaleLowerCase('de-DE');
  return (
    needle === '' ||
    entry.targetText.toLocaleLowerCase('de-DE').includes(needle) ||
    entry.nativeText.toLocaleLowerCase('de-DE').includes(needle)
  );
};

// Entries with no enabled direction learned yet are learned first; any other
// selection is practised.
const intentFor = (
  selectedEntries: ReadonlyArray<VocabularyEntry>,
  enabledDirections: ReadonlyArray<AnswerDirection>,
): 'learn' | 'practice' =>
  selectedEntries.every((entry) =>
    entry.cards
      .filter((card) => enabledDirections.includes(card.direction))
      .every((card) => card.introducedAt === null),
  )
    ? 'learn'
    : 'practice';

// The entry whose details are open, looked up among all entries, so a
// filter change behind the dialog cannot take its entry away. Its row may be
// gone by the time the dialog closes: deleted, or no longer matching. A
// refreshed list without the entry closes the dialog as well.
const useEntryDialog = (
  entries: ReadonlyArray<VocabularyEntry>,
  visible: ReadonlyArray<VocabularyEntry>,
) => {
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [rowGone, setRowGone] = useState(false);
  const openEntry = entries.find((entry) => entry.id === openEntryId);
  const close = (removed: boolean) => {
    setRowGone(removed || !visible.some((entry) => entry.id === openEntryId));
    setOpenEntryId(null);
  };
  return {
    openEntry,
    rowGone: rowGone || (openEntryId !== null && openEntry === undefined),
    open: setOpenEntryId,
    close,
  } as const;
};

export const VocabularyLibrary = ({
  enabledDirections,
  entries,
  initialFilter,
  initialPlaceId,
  layout,
  subject,
  renderStudyAction,
  entryActions,
  fallbackFocusRef,
}: VocabularyLibraryProps) => {
  const nouns = courseNouns(subject);
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
  const visible = entries.filter(
    (entry) =>
      matchesQuery(entry, query) &&
      (layout === 'flat' ||
        placeFilter === 'all' ||
        isInPlace(entry, placeFilter)) &&
      matchesFilter(entry, enabledDirections, filter, now),
  );
  const sections: ReadonlyArray<VocabularySection> =
    layout === 'by-place'
      ? placeSections(visible)
      : [['Alle auswählen', visible]];
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
  const dialog = useEntryDialog(entries, visible);
  const selectionIntent = intentFor(
    entries.filter((entry) => selected.includes(entry.id)),
    enabledDirections,
  );

  return (
    <div className="flex flex-col gap-5">
      <VocabularyFilters
        filter={filter}
        nouns={nouns}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        query={query}
        placeSelect={
          layout === 'by-place'
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
          Schwierige {nouns.plural} auswählen
        </Button>
      ) : null}
      {visible.length === 0 ? (
        <p className={`${cardClass} text-sm`}>
          Für diese Auswahl wurden keine {nouns.plural} gefunden.
        </p>
      ) : (
        sections.map(([label, sectionEntries]) => (
          <VocabularyUnitSection
            enabledDirections={enabledDirections}
            entries={sectionEntries}
            key={label}
            label={label}
            labelStyle={layout === 'by-place' ? 'heading' : 'plain'}
            now={now}
            onOpenEntry={dialog.open}
            onToggleAll={toggleAll}
            onToggleEntry={toggleEntry}
            selected={selected}
            subject={subject}
          />
        ))
      )}
      {selected.length === 0 ? null : (
        <VocabularySelectionBar count={selected.length} nouns={nouns}>
          {renderStudyAction(selected, selectionIntent)}
        </VocabularySelectionBar>
      )}
      <VocabularyEntryDialog
        actions={entryActions}
        enabledDirections={enabledDirections}
        entry={dialog.openEntry}
        now={now}
        onClose={() => dialog.close(false)}
        onRemoved={(entryId) => {
          dialog.close(true);
          setSelected((current) => current.filter((id) => id !== entryId));
        }}
        returnFocusRef={dialog.rowGone ? fallbackFocusRef : undefined}
        subject={subject}
      />
    </div>
  );
};
