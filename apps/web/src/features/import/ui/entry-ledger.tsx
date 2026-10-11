import { maximumEntriesPerPage } from '@wordhold/ai/extraction/schema';
import { PlusIcon } from 'lucide-react';
import type { GeneratedExample } from '../../../shared/examples/example-draft';
import { Button } from '../../../shared/ui/button';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Book, Unit } from '../services/repository';
import { BookPicker } from './book-picker';
import { type RowRemoval, rowWasAdded, type UnitSection } from './draft-rows';
import { entryRange } from './entry-range';
import { EntryRow } from './entry-row';
import { ledgerGrid } from './ledger-grid';
import { LedgerSectionHead } from './ledger-section-head';
import { RemovedRow } from './removed-row';
import { UnitPicker } from './unit-picker';
import type { DraftForm } from './use-draft-form';
import { entryIsComplete } from './verify-form-selection';

const unitName = (
  units: ReadonlyArray<Unit>,
  unit: UnitSelectionData,
): string => {
  switch (unit.kind) {
    case 'existing':
      return (
        units.find((candidate) => candidate.id === unit.unitId)?.name ??
        'Einheit'
      );
    case 'new':
      return unit.name.trim() === ''
        ? 'Neue Einheit'
        : `${unit.name.trim()} (neu)`;
    default:
      return 'Ohne Einheit';
  }
};

// The run the removed row returns to on undo: the run it continued, or the
// run it started, which moved on to the next row.
const removalSectionStart = (
  sections: ReadonlyArray<UnitSection>,
  removal: RowRemoval,
): number | undefined => {
  const holding =
    removal.row.unitFrom === undefined
      ? (section: UnitSection) =>
          section.start < removal.index && removal.index <= section.end
      : (section: UnitSection) => section.start === removal.index;
  return (sections.find(holding) ?? sections.at(-1))?.start;
};

type EntryLedgerProps = {
  readonly form: DraftForm;
  readonly books: ReadonlyArray<Book>;
  readonly targetLabel: string;
  readonly busy: boolean;
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
};

// The page's words as a vocabulary notebook keeps them: filed under a book
// and unit, one ruled line per word, the German in the right-hand column.
export const EntryLedger = ({
  form,
  books,
  targetLabel,
  busy,
  generateExample,
  translateExample,
}: EntryLedgerProps) => {
  const { rows, sections, bookUnits, formState, removal } = form;
  const [firstSection, ...laterSections] = sections;
  const sectionRequiresUnit = (section: UnitSection) =>
    rows.slice(section.start, section.end).some(entryIsComplete);
  const removedRow =
    removal === null ? null : (
      <RemovedRow
        disabled={busy}
        key="removed"
        onUndo={form.undoRemoval}
        removal={removal}
      />
    );
  const removedRowSection =
    removal === null ? undefined : removalSectionStart(sections, removal);

  const sectionRows = (section: UnitSection) => (
    <ul
      aria-label={`${unitName(bookUnits, section.unit)}: ${entryRange(section.start, section.end)}`}
      key={rows[section.start]?.rowId}
    >
      {rows.slice(section.start, section.end).flatMap((row, offset) => {
        const index = section.start + offset;
        const entryRow = (
          <EntryRow
            added={rowWasAdded(row)}
            disabled={busy}
            duplicate={formState.duplicates[index] ?? { verdict: 'none' }}
            duplicateConfirmed={row.duplicateConfirmed}
            entry={row}
            entryNumber={index + 1}
            generateExample={generateExample}
            key={row.rowId}
            onChange={(next) => form.changeEntry(index, next)}
            onDuplicateConfirmedChange={(confirmed) =>
              form.confirmDuplicate(index, confirmed)
            }
            onGeneratedExample={(source, generated) =>
              form.applyGeneratedExample(row.rowId, source, generated)
            }
            onRemove={() => form.removeRow(index)}
            onStartUnit={
              offset === 0 ? null : () => form.startUnit(index, section.unit)
            }
            onTranslatedExample={(sentence, native) =>
              form.applyTranslatedExample(row.rowId, sentence, native)
            }
            rowId={row.rowId}
            targetLabel={targetLabel}
            translateExample={translateExample}
          />
        );
        return removedRowSection === section.start && removal?.index === index
          ? [removedRow, entryRow]
          : [entryRow];
      })}
      {removedRowSection === section.start && removal?.index === section.end
        ? removedRow
        : null}
    </ul>
  );

  return (
    <div className="border border-border bg-card px-2 pt-4 pb-2 sm:px-3">
      <div className={`${ledgerGrid} gap-y-4 pb-4`}>
        <div className="col-start-2 sm:pr-4">
          <BookPicker
            books={books}
            disabled={busy}
            onChange={form.changeBook}
            selection={form.book}
          />
        </div>
        {firstSection === undefined ? null : (
          <div className="col-start-2 sm:col-start-3 sm:pl-4">
            <UnitPicker
              detail={
                laterSections.length === 0 ? null : (
                  <span className="text-muted-foreground text-xs">
                    {entryRange(firstSection.start, firstSection.end)}
                  </span>
                )
              }
              disabled={busy}
              label="Einheit"
              onChange={(unit) => form.changeSectionUnit(0, unit)}
              required={sectionRequiresUnit(firstSection)}
              selection={firstSection.unit}
              units={bookUnits}
            />
          </div>
        )}
      </div>
      <div
        aria-hidden={true}
        className={`${ledgerGrid} hidden border-primary/40 border-b-4 border-double pb-1.5 sm:grid`}
      >
        <span className="eyebrow col-start-2 pl-1">{targetLabel}</span>
        <span className="eyebrow col-start-3 pl-5">Deutsch</span>
      </div>
      {rows.length === 0 && removedRow !== null ? <ul>{removedRow}</ul> : null}
      {rows.length === 0 ? (
        <p className="border-border border-b py-4 pl-1 text-muted-foreground text-sm sm:pl-10">
          Diese Seite hat noch keine Einträge. Füge die Vokabeln von dem Foto
          selbst hinzu.
        </p>
      ) : null}
      {firstSection === undefined ? null : sectionRows(firstSection)}
      {laterSections.map((section) => {
        const rowId = rows[section.start]?.rowId ?? '';
        return (
          <div key={rowId}>
            <LedgerSectionHead
              disabled={busy}
              end={section.end}
              onChange={(unit) => form.changeSectionUnit(section.start, unit)}
              onJoin={() => form.joinUnit(section.start)}
              required={sectionRequiresUnit(section)}
              rowId={rowId}
              start={section.start}
              unit={section.unit}
              units={bookUnits}
            />
            {sectionRows(section)}
          </div>
        );
      })}
      <Button
        className="w-full justify-start pl-1 sm:pl-10"
        data-ledger-add={true}
        disabled={busy || rows.length >= maximumEntriesPerPage}
        onClick={form.appendRow}
        variant="quiet-muted"
      >
        <PlusIcon aria-hidden={true} className="size-4" />
        Eintrag hinzufügen
      </Button>
    </div>
  );
};
