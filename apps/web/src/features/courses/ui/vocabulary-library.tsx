import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import { VocabularyFilters } from './vocabulary-filters';
import { VocabularySchedule } from './vocabulary-schedule';

const isDue = (entry: VocabularyEntry, now: Date) =>
  entry.cards.some(
    (card) =>
      card.introducedAt !== null &&
      card.state !== 'new' &&
      card.dueAt !== null &&
      card.dueAt <= now,
  );

const matchesFilter = (
  entry: VocabularyEntry,
  filter: VocabularyFilter,
  now: Date,
) => {
  if (filter === 'due') {
    return isDue(entry, now);
  }
  if (filter === 'first-reviews') {
    return entry.cards.some(
      (card) => card.introducedAt !== null && card.state === 'new',
    );
  }
  if (filter === 'difficult') {
    return entry.cards.some((card) => card.failures >= 2);
  }
  return true;
};

type VocabularyLibraryProps = {
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly initialFilter: VocabularyFilter;
  readonly targetLanguage: LanguageCode;
  readonly renderStudyAction: (entryIds: ReadonlyArray<string>) => ReactNode;
};

export const VocabularyLibrary = ({
  entries,
  initialFilter,
  targetLanguage,
  renderStudyAction,
}: VocabularyLibraryProps) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VocabularyFilter>(initialFilter);
  const [unitFilter, setUnitFilter] = useState('all');
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
  const now = useMemo(() => new Date(), []);
  const visible = entries.filter((entry) => {
    const needle = query.trim().toLocaleLowerCase('de-DE');
    const matchesQuery =
      needle === '' ||
      entry.targetText.toLocaleLowerCase('de-DE').includes(needle) ||
      entry.nativeText.toLocaleLowerCase('de-DE').includes(needle);
    const matchesUnit = unitFilter === 'all' || entry.unitId === unitFilter;
    return matchesQuery && matchesUnit && matchesFilter(entry, filter, now);
  });
  const units = Map.groupBy(visible, (entry) => entry.unitName);
  const unitOptions = [
    ...new Map(
      entries.map((entry) => [entry.unitId, entry.unitName]),
    ).entries(),
  ];
  const toggle = (entryId: string) =>
    setSelected((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    );

  return (
    <div className="flex flex-col gap-5">
      <VocabularyFilters
        filter={filter}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        onUnitChange={setUnitFilter}
        query={query}
        unitFilter={unitFilter}
        unitOptions={unitOptions}
      />
      {filter === 'difficult' && visible.some((entry) => entry.introduced) ? (
        <button
          className="min-h-11 w-fit border border-input px-4 py-2 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() =>
            setSelected(
              visible
                .filter((entry) => entry.introduced)
                .map((entry) => entry.id),
            )
          }
          type="button"
        >
          Schwierige Vokabeln auswählen
        </button>
      ) : null}
      {[...units].map(([unitName, unitEntries]) => {
        const selectable = unitEntries.filter((entry) => entry.introduced);
        const unitSelected =
          selectable.length > 0 &&
          selectable.every((entry) => selected.includes(entry.id));
        return (
          <section className="flex flex-col gap-2" key={unitName}>
            <label className="flex min-h-11 items-center gap-3 font-display text-xl">
              <input
                checked={unitSelected}
                className="size-5 accent-primary"
                disabled={selectable.length === 0}
                onChange={() =>
                  setSelected((current) =>
                    unitSelected
                      ? current.filter(
                          (id) => !selectable.some((entry) => entry.id === id),
                        )
                      : [
                          ...current,
                          ...selectable
                            .map((entry) => entry.id)
                            .filter((id) => !current.includes(id)),
                        ],
                  )
                }
                type="checkbox"
              />
              {unitName}
            </label>
            <ul className="divide-y divide-border border border-border bg-card">
              {unitEntries.map((entry) => (
                <li className="flex gap-3 p-4" key={entry.id}>
                  <input
                    aria-label={`${entry.targetText} auswählen`}
                    checked={selected.includes(entry.id)}
                    className="mt-1 size-5 accent-primary"
                    disabled={!entry.introduced}
                    onChange={() => toggle(entry.id)}
                    type="checkbox"
                  />
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 sm:items-start">
                    <p>
                      <span className="font-medium" lang={targetLanguage}>
                        {entry.targetText}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {entry.nativeText}
                      </span>
                    </p>
                    <VocabularySchedule
                      entry={entry}
                      now={now}
                      targetLanguage={targetLanguage}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {visible.length === 0 ? (
        <p className="border border-border bg-card p-6 text-sm">
          Für diese Auswahl wurden keine Vokabeln gefunden.
        </p>
      ) : null}
      {selected.length === 0 ? null : (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 border border-primary bg-card p-4 shadow-lg">
          <p className="font-medium">{selected.length} ausgewählt</p>
          {renderStudyAction(selected)}
        </div>
      )}
    </div>
  );
};
