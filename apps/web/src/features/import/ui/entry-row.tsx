import type { GrammarInfo } from '@wordhold/ai/extraction/schema';
import {
  maximumEntryTextLength,
  maximumExampleLength,
} from '@wordhold/ai/extraction/schema';
import type { ReactNode } from 'react';
import type { DuplicateVerdict } from '../services/entry-identity';

export type DraftEntry = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
  readonly grammar?: GrammarInfo;
  readonly confidence?: number;
};

const lowConfidence = 0.8;

const grammarSummary = (grammar: GrammarInfo): string => {
  switch (grammar._tag) {
    case 'noun':
      return ['Nomen', grammar.gender, grammar.plural]
        .filter(Boolean)
        .join(', ');
    case 'verb':
      return ['Verb', ...(grammar.irregularForms ?? []), grammar.note]
        .filter(Boolean)
        .join(', ');
    case 'adjective':
      return ['Adjektiv', grammar.comparative, grammar.superlative]
        .filter(Boolean)
        .join(', ');
    case 'other':
      return grammar.note ?? '';
    default:
      return '';
  }
};

type EntryRowProps = {
  readonly entry: DraftEntry;
  readonly disabled: boolean;
  readonly targetLabel: string;
  readonly unitControl: ReactNode;
  readonly duplicate: DuplicateVerdict;
  readonly duplicateConfirmed: boolean;
  readonly onChange: (entry: DraftEntry) => void;
  readonly onDuplicateConfirmedChange: (confirmed: boolean) => void;
  readonly onRemove: () => void;
};

export const EntryRow = ({
  entry,
  disabled,
  targetLabel,
  unitControl,
  duplicate,
  duplicateConfirmed,
  onChange,
  onDuplicateConfirmedChange,
  onRemove,
}: EntryRowProps) => {
  const uncertain =
    entry.confidence !== undefined && entry.confidence < lowConfidence;
  const flagged = uncertain || duplicate !== 'none';
  const inputClass = 'w-full border border-input bg-card px-2 py-1.5 text-sm';
  return (
    <li
      className={`flex flex-col gap-2 border p-3 ${
        flagged
          ? 'border-warning-foreground/40 bg-warning'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-2">
        {uncertain ? (
          <span className="text-warning-foreground text-xs">
            unsicher gelesen
          </span>
        ) : null}
        {duplicate === 'none' ? null : (
          <span className="text-warning-foreground text-xs">
            Schon in dieser Einheit
          </span>
        )}
        <button
          className="ml-auto text-muted-foreground text-sm underline"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          Entfernen
        </button>
      </div>
      {unitControl}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          aria-label={targetLabel}
          className={inputClass}
          disabled={disabled}
          maxLength={maximumEntryTextLength}
          onChange={(event) =>
            onChange({ ...entry, targetText: event.target.value })
          }
          placeholder={targetLabel}
          value={entry.targetText}
        />
        <input
          aria-label="Deutsch"
          className={inputClass}
          disabled={disabled}
          maxLength={maximumEntryTextLength}
          onChange={(event) =>
            onChange({ ...entry, nativeText: event.target.value })
          }
          placeholder="Deutsch"
          value={entry.nativeText}
        />
      </div>
      <input
        aria-label="Beispielsatz"
        className={inputClass}
        disabled={disabled}
        maxLength={maximumExampleLength}
        onChange={(event) =>
          onChange({ ...entry, example: event.target.value })
        }
        placeholder="Beispielsatz (optional)"
        value={entry.example}
      />
      {entry.grammar === undefined ? null : (
        <p className="text-muted-foreground text-xs">
          {grammarSummary(entry.grammar)}
        </p>
      )}
      {duplicate === 'exact' ? (
        <p className="text-warning-foreground text-xs">
          Wird nicht erneut importiert. Für eine Ausnahme ändere die
          Schreibweise oder den Beispielsatz.
        </p>
      ) : null}
      {duplicate === 'exception' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={duplicateConfirmed}
            className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            disabled={disabled}
            onChange={(event) =>
              onDuplicateConfirmedChange(event.target.checked)
            }
            type="checkbox"
          />
          Als Ausnahme importieren (andere Schreibweise oder anderes Beispiel)
        </label>
      ) : null}
    </li>
  );
};
