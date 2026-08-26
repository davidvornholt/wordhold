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
    unit: UnitSelectionData,
    verifiedEntries: ReadonlyArray<DraftEntry>,
  ) => void;
};

// The unit a course is currently working through is the last one started, so
// that is what the picker opens on. A course with no units yet has nothing to
// choose from and starts naming one straight away.
const initialSelection = (units: ReadonlyArray<Unit>): UnitSelectionData =>
  units.length === 0
    ? { kind: 'new', name: '' }
    : { kind: 'existing', unitId: units.at(-1)?.id ?? '' };

export const VerifyForm = ({
  initialEntries,
  initialLabel,
  targetLabel,
  units,
  busy,
  onSubmit,
}: VerifyFormProps) => {
  const [label, setLabel] = useState(initialLabel);
  const [unit, setUnit] = useState(() => initialSelection(units));
  const [draftEntries, setDraftEntries] = useState(initialEntries);

  const complete = draftEntries.filter(
    (entry) => entry.targetText.trim() !== '' && entry.nativeText.trim() !== '',
  );
  const unitNamed = unit.kind === 'existing' || unit.name.trim() !== '';

  return (
    <form
      aria-busy={busy}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !unitNamed) {
          return;
        }
        onSubmit(label, unit, complete);
      }}
    >
      <UnitPicker
        disabled={busy}
        onChange={setUnit}
        selection={unit}
        units={units}
      />
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
                  i === index ? next : current,
                ),
              )
            }
            onRemove={() =>
              setDraftEntries(draftEntries.filter((_, i) => i !== index))
            }
            targetLabel={targetLabel}
          />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="border border-input px-3 py-1.5 text-sm"
          disabled={busy || draftEntries.length >= maximumEntriesPerPage}
          onClick={() => setDraftEntries([...draftEntries, emptyEntry])}
          type="button"
        >
          Eintrag hinzufügen
        </button>
        <button
          className="bg-primary px-4 py-1.5 text-primary-foreground text-sm disabled:opacity-50"
          disabled={busy || complete.length === 0 || !unitNamed}
          type="submit"
        >
          {busy ? 'Importiere …' : `${complete.length} Einträge importieren`}
        </button>
      </div>
    </form>
  );
};
