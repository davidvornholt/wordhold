import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, type RefObject, useMemo, useState } from 'react';
import {
  type CourseNouns,
  type CourseSubject,
  courseNouns,
  isListCourse,
} from '../../../shared/directions';
import type { PreparePitfalls } from '../../../shared/pitfalls/pitfall-model';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';
import { wordLocation } from '../../../shared/vocabulary/book-name';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import type { CourseEntryActions } from './entry-actions';
import type { StudyAction } from './study-action';
import { useListPitfalls } from './use-list-pitfalls';
import { VocabularyEntryDialog } from './vocabulary-entry-details';
import {
  byDifficulty,
  matchesFilter,
  showsPitfalls,
} from './vocabulary-filter-logic';
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
  readonly renderStudyAction: (action: StudyAction) => ReactNode;
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

const selectLabels: Partial<
  Record<VocabularyFilter, (plural: string) => string>
> = {
  difficult: (plural) => `Schwierige ${plural} auswählen`,
  pitfalls: (plural) => `${plural} mit Stolperstellen auswählen`,
};

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

// The search and, for a list by place, the book or unit chosen.
type ListScope = {
  readonly query: string;
  readonly layout: VocabularyLibraryProps['layout'];
  readonly placeFilter: string;
};

const isListed = (entry: VocabularyEntry, scope: ListScope): boolean =>
  matchesQuery(entry, scope.query) &&
  (scope.layout === 'flat' ||
    scope.placeFilter === 'all' ||
    isInPlace(entry, scope.placeFilter));

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

// The entries chosen for practice or for skipping their learning pass.
const useSelection = () => {
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
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
  return { selected, setSelected, toggleEntry, toggleAll } as const;
};

// The entries the list shows under its search, place and filter, and the
// same in sections. Listing words by their pitfalls finds them for the
// listed words that have none stored yet. Listing difficult words puts the
// most often missed first in each section.
const useListedEntries = ({
  entries,
  enabledDirections,
  filter,
  layout,
  placeFilter,
  query,
  preparePitfalls,
}: ListScope & {
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly filter: VocabularyFilter;
  readonly preparePitfalls: PreparePitfalls;
}) => {
  const now = useMemo(() => new Date(), []);
  const unsearched = useMemo(
    () =>
      filter === 'pitfalls'
        ? entries.filter(
            (entry) =>
              entry.spellingPitfalls === null &&
              isListed(entry, { query, layout, placeFilter }),
          )
        : [],
    [entries, filter, layout, placeFilter, query],
  );
  const { withPitfalls, searching } = useListPitfalls(
    unsearched,
    preparePitfalls,
  );
  const shown = entries.map(withPitfalls);
  const visible = shown.filter(
    (entry) =>
      isListed(entry, { query, layout, placeFilter }) &&
      matchesFilter(entry, enabledDirections, filter, now),
  );
  const ordered = (sectionEntries: ReadonlyArray<VocabularyEntry>) =>
    filter === 'difficult'
      ? sectionEntries.toSorted(byDifficulty(enabledDirections))
      : sectionEntries;
  const sections: ReadonlyArray<VocabularySection> = (
    layout === 'by-place'
      ? placeSections(visible)
      : [['Alle auswählen', visible] as const]
  ).map(([label, sectionEntries]) => [label, ordered(sectionEntries)]);
  return { now, shown, visible, sections, searching } as const;
};

// How many listed words still have their pitfalls looked for. Empty once
// all are found, so the region is in place before the search starts.
const PitfallSearchStatus = ({
  nouns,
  searching,
}: {
  readonly nouns: CourseNouns;
  readonly searching: number;
}) => (
  <p className="text-muted-foreground text-sm empty:hidden" role="status">
    {searching > 0
      ? `Stolperstellen werden gesucht: noch ${searching} ${
          searching === 1 ? nouns.singular : nouns.plural
        }`
      : ''}
  </p>
);

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
  const pitfalls =
    !isListCourse(subject.kind) && showsPitfalls(enabledDirections);
  const [query, setQuery] = useState('');
  // A link may ask for pitfalls where no word is spelled by the learner.
  const [filter, setFilter] = useState<VocabularyFilter>(
    initialFilter === 'pitfalls' && !pitfalls ? 'all' : initialFilter,
  );
  const [placeFilter, setPlaceFilter] = useState(
    initialPlaceId !== undefined &&
      entries.some((entry) => isInPlace(entry, initialPlaceId))
      ? initialPlaceId
      : 'all',
  );
  const { selected, setSelected, toggleEntry, toggleAll } = useSelection();
  const { now, shown, visible, sections, searching } = useListedEntries({
    entries,
    enabledDirections,
    filter,
    layout,
    placeFilter,
    query,
    preparePitfalls: entryActions.preparePitfalls,
  });
  const dialog = useEntryDialog(shown, visible);
  const selectedEntries = shown.filter((entry) => selected.includes(entry.id));
  const selectLabel = selectLabels[filter]?.(nouns.plural);
  const list = {
    filter,
    place:
      layout === 'by-place' && placeFilter !== 'all' ? placeFilter : undefined,
  };

  return (
    <div className="flex flex-col gap-5">
      <VocabularyFilters
        filter={filter}
        nouns={nouns}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        pitfalls={pitfalls}
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
      {selectLabel !== undefined &&
      visible.some((entry) => entry.introduced) ? (
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
          {selectLabel}
        </Button>
      ) : null}
      <PitfallSearchStatus nouns={nouns} searching={searching} />
      {visible.length === 0 && searching === 0 ? (
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
            showPitfalls={filter === 'pitfalls'}
            subject={subject}
          />
        ))
      )}
      <VocabularySelectionBar
        actions={entryActions}
        enabledDirections={enabledDirections}
        entries={selectedEntries}
        renderStudyAction={(intent, primary) =>
          renderStudyAction({ entryIds: selected, intent, primary, list })
        }
        subject={subject}
      />
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
