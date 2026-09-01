import type { GrammarInfo } from '@wordhold/ai/extraction/schema';
import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import type { ReactNode } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldCompactClass } from '../../../shared/ui/field-styles';
import { Checkbox } from '../../../shared/ui/selection-controls';
import type { DuplicateVerdict } from '../services/entry-identity';
import { EntryExampleEditor } from './entry-example-editor';

export type DraftEntry = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
  readonly generatedExample?: {
    readonly nativeText: string;
  };
  readonly grammar?: GrammarInfo;
  readonly confidence?: number;
};

export type ExampleGenerationSource = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
};

export type GeneratedExample = {
  readonly target: string;
  readonly native: string;
};

const lowConfidence = 0.8;

const genderLabels = {
  masculine: 'maskulin',
  feminine: 'feminin',
  neuter: 'neutrum',
} as const;

// The book's own annotations (gender, plural, verb forms), read from the scan
// and stored with the entry. Rendered as dictionary-style fine print under the
// word pair so the learner can check them against the photographed page.
const grammarSummary = (grammar: GrammarInfo): string => {
  switch (grammar._tag) {
    case 'noun':
      return [
        'Nomen',
        grammar.gender === undefined ? undefined : genderLabels[grammar.gender],
        grammar.plural === undefined ? undefined : `Plural: ${grammar.plural}`,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'verb':
      return [
        'Verb',
        grammar.irregularForms === undefined ||
        grammar.irregularForms.length === 0
          ? undefined
          : `Formen: ${grammar.irregularForms.join(', ')}`,
        grammar.note,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'adjective': {
      const comparison = [grammar.comparative, grammar.superlative]
        .filter(Boolean)
        .join(', ');
      return comparison === ''
        ? 'Adjektiv'
        : `Adjektiv · Steigerung: ${comparison}`;
    }
    case 'other':
      return grammar.note ?? '';
    default:
      return '';
  }
};

type EntryRowProps = {
  readonly entry: DraftEntry;
  readonly entryNumber: number;
  readonly disabled: boolean;
  readonly targetLabel: string;
  readonly unitControl: ReactNode;
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<{ readonly target: string; readonly native: string }>;
  readonly duplicate: DuplicateVerdict;
  readonly duplicateConfirmed: boolean;
  readonly onChange: (entry: DraftEntry) => void;
  readonly onGeneratedExample: (
    source: ExampleGenerationSource,
    generated: GeneratedExample,
  ) => void;
  readonly onDuplicateConfirmedChange: (confirmed: boolean) => void;
  readonly onRemove: () => void;
};

export const EntryRow = ({
  entry,
  entryNumber,
  disabled,
  targetLabel,
  unitControl,
  generateExample,
  duplicate,
  duplicateConfirmed,
  onChange,
  onGeneratedExample,
  onDuplicateConfirmedChange,
  onRemove,
}: EntryRowProps) => {
  const duplicateConfirmationId = `duplicate-confirmation-${entryNumber}`;
  const uncertain =
    entry.confidence !== undefined && entry.confidence < lowConfidence;
  const flagged = uncertain || duplicate !== 'none';
  const grammar =
    entry.grammar === undefined ? '' : grammarSummary(entry.grammar);
  const inputClass = fieldCompactClass;
  return (
    <li
      className={`flex flex-col gap-2 border p-3 ${
        flagged
          ? 'border-warning-foreground/40 border-l-4 border-l-warning-foreground bg-warning'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="eyebrow">Eintrag {entryNumber}</span>
        {uncertain ? (
          <span className="font-medium text-warning-foreground text-xs">
            Unsicher gelesen – bitte prüfen
          </span>
        ) : null}
        {duplicate === 'none' ? null : (
          <span className="font-medium text-warning-foreground text-xs">
            Schon in dieser Einheit
          </span>
        )}
        <Button
          aria-label={`Eintrag ${entryNumber} entfernen`}
          className="ml-auto"
          disabled={disabled}
          onClick={onRemove}
          variant="quiet-muted"
        >
          Entfernen
        </Button>
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
      <EntryExampleEditor
        disabled={disabled}
        entry={entry}
        generate={generateExample}
        onChange={onChange}
        onGenerated={onGeneratedExample}
      />
      {grammar === '' ? null : (
        <p className="text-muted-foreground text-xs">{grammar}</p>
      )}
      {duplicate === 'exact' ? (
        <p className="text-warning-foreground text-xs">
          Wird nicht erneut importiert. Für eine Ausnahme ändere die
          Schreibweise oder den Beispielsatz.
        </p>
      ) : null}
      {duplicate === 'exception' ? (
        <label
          className="flex items-center gap-2 text-sm"
          htmlFor={duplicateConfirmationId}
        >
          <Checkbox
            checked={duplicateConfirmed}
            disabled={disabled}
            id={duplicateConfirmationId}
            onChange={(event) =>
              onDuplicateConfirmedChange(event.target.checked)
            }
          />
          Als Ausnahme importieren (andere Schreibweise oder anderes Beispiel)
        </label>
      ) : null}
      {unitControl}
    </li>
  );
};
