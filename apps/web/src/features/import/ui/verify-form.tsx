import {
  maximumEntriesPerPage,
  maximumLabelLength,
} from '@wordhold/ai/extraction/schema';
import { useState } from 'react';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';
import { type DraftEntry, EntryRow } from './entry-row';
import { UnitPicker } from './unit-picker';

const emptyEntry: DraftEntry = {
  type: 'word',
  targetText: '',
  nativeText: '',
  example: '',
};

type VerifyFormProps = {
  readonly initialEntries: ReadonlyArray<DraftEntry>;
  readonly initialLabel: string;
  readonly targetLabel: string;
  readonly units: ReadonlyArray<Unit>;
  readonly busy: boolean;
  readonly onSubmit: (
    label: string,
    verifiedEntries: ReadonlyArray<VerificationEntry>,
  ) => void;
};

export type VerificationEntry = DraftEntry & {
  readonly unit: UnitSelectionData;
};

const entryIsComplete = (entry: DraftEntry): boolean =>
  entry.targetText.trim() !== '' && entry.nativeText.trim() !== '';

// The unit a course is currently working through is the last one started, so
// that is what the picker opens on. A course with no units yet has nothing to
// choose from and starts naming one straight away.
const initialUnitSelection = (
  units: ReadonlyArray<Unit>,
): UnitSelectionData => {
  const latestRealUnit = units.findLast((unit) => !unit.isHolding);
  return latestRealUnit === undefined
    ? { kind: 'new', name: '' }
    : { kind: 'existing', unitId: latestRealUnit.id };
};

export const VerifyForm = ({
  initialEntries,
  initialLabel,
  targetLabel,
  units,
  busy,
  onSubmit,
}: VerifyFormProps) => {
  const [label, setLabel] = useState(initialLabel);
  const [draftEntries, setDraftEntries] = useState<
    ReadonlyArray<VerificationEntry>
  >(() =>
    initialEntries.map((entry) => ({
      ...entry,
      unit: initialUnitSelection(units),
    })),
  );

  const complete = draftEntries.filter(entryIsComplete);
  const unitsNamed = complete.every(
    (entry) => entry.unit.kind === 'existing' || entry.unit.name.trim() !== '',
  );

  return (
    <form
      aria-busy={busy}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || complete.length === 0 || !unitsNamed) {
          return;
        }
        onSubmit(label, complete);
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Seitenbezeichnung
        <input
          className="border border-input bg-card px-2 py-1.5"
          disabled={busy}
          maxLength={maximumLabelLength}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="z. B. Unité 3, Seite 42"
          value={label}
        />
      </label>
      <ul className="flex flex-col gap-3">
        {draftEntries.map((entry, index) => (
          <EntryRow
            disabled={busy}
            entry={entry}
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional edits of one page
            key={index}
            onChange={(next) =>
              setDraftEntries(
                draftEntries.map((current, i) =>
                  i === index ? { ...next, unit: current.unit } : current,
                ),
              )
            }
            onRemove={() =>
              setDraftEntries(draftEntries.filter((_, i) => i !== index))
            }
            targetLabel={targetLabel}
            unitControl={
              <UnitPicker
                disabled={busy}
                label={`Einheit für Eintrag ${index + 1}`}
                onChange={(unit) =>
                  setDraftEntries(
                    draftEntries.map((current, i) =>
                      i === index ? { ...current, unit } : current,
                    ),
                  )
                }
                required={entryIsComplete(entry)}
                selection={entry.unit}
                units={units}
              />
            }
          />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="border border-input px-3 py-1.5 text-sm"
          disabled={busy || draftEntries.length >= maximumEntriesPerPage}
          onClick={() =>
            setDraftEntries([
              ...draftEntries,
              { ...emptyEntry, unit: initialUnitSelection(units) },
            ])
          }
          type="button"
        >
          Eintrag hinzufügen
        </button>
        <button
          className="bg-primary px-4 py-1.5 text-primary-foreground text-sm disabled:opacity-50"
          disabled={busy || complete.length === 0 || !unitsNamed}
          type="submit"
        >
          {busy ? 'Importiere …' : `${complete.length} Einträge importieren`}
        </button>
      </div>
    </form>
  );
};
