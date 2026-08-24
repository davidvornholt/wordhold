import type { GrammarInfo } from '@wordhold/ai/extraction/schema';
import {
  maximumEntryTextLength,
  maximumExampleLength,
} from '@wordhold/ai/extraction/schema';
import type { EntryType } from '@wordhold/db/schema/entries';

export type DraftEntry = {
  readonly type: EntryType;
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
  readonly grammar?: GrammarInfo;
  readonly confidence?: number;
};

const typeLabels: Record<EntryType, string> = {
  word: 'Wort',
  expression: 'Ausdruck',
  sentence: 'Satz',
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
  readonly onChange: (entry: DraftEntry) => void;
  readonly onRemove: () => void;
};

export const EntryRow = ({
  entry,
  disabled,
  targetLabel,
  onChange,
  onRemove,
}: EntryRowProps) => {
  const uncertain =
    entry.confidence !== undefined && entry.confidence < lowConfidence;
  const inputClass =
    'w-full rounded border border-neutral-300 px-2 py-1.5 text-sm';
  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        uncertain ? 'border-amber-400 bg-amber-50' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <select
          aria-label="Typ"
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...entry, type: event.target.value as EntryType })
          }
          value={entry.type}
        >
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {uncertain ? (
          <span className="text-amber-700 text-xs">unsicher gelesen</span>
        ) : null}
        <button
          className="ml-auto text-neutral-500 text-sm underline"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          Entfernen
        </button>
      </div>
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
        <p className="text-neutral-500 text-xs">
          {grammarSummary(entry.grammar)}
        </p>
      )}
    </li>
  );
};
