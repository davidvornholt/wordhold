import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import { SparklesIcon } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { ExampleErrors } from '../../../shared/ui/example-draft-editor';
import { ledgerFieldClass } from '../../../shared/ui/field-styles';
import type { useExampleDraft } from '../../../shared/ui/use-example-draft';
import {
  relationKinds,
  relationLabels,
} from '../../../shared/vocabulary/related-words';
import type { DraftEntry } from './entry-row';
import { ledgerField } from './ledger-keyboard';

// Example text is a sentence: it wraps instead of scrolling out of its
// column, and Enter moves to the next line of the ledger.
const exampleFieldClass = `${ledgerFieldClass} field-sizing-content resize-none font-display italic`;

type ColumnProps = {
  readonly entry: DraftEntry;
  readonly disabled: boolean;
  readonly example: ReturnType<typeof useExampleDraft<DraftEntry>>;
  readonly onChange: (entry: DraftEntry) => void;
};

// Synonyms and antonyms are rare on a vocabulary page, so their lines stay
// folded away until a row has some or the learner asks for them.
const RelationFields = ({
  entry,
  disabled,
  onChange,
}: Omit<ColumnProps, 'example'>) => {
  const fieldId = useId();
  const hasRelations = relationKinds.some((kind) => (entry[kind] ?? '') !== '');
  // Once open, the lines stay: clearing them must not pull the field away
  // from under the cursor.
  const [opened, setOpened] = useState(hasRelations);
  const openedByToggleRef = useRef(false);
  const focusOpened = useCallback((field: HTMLInputElement | null) => {
    if (field !== null && openedByToggleRef.current) {
      openedByToggleRef.current = false;
      field.focus();
    }
  }, []);
  const shown = hasRelations || opened;

  return (
    <>
      {shown ? null : (
        <Button
          className="self-start px-1"
          disabled={disabled}
          onClick={() => {
            openedByToggleRef.current = true;
            setOpened(true);
          }}
          variant="fine-print"
        >
          + Synonyme, Gegenteile
        </Button>
      )}
      {/* A filled line no longer shows its placeholder, so each one keeps a
          visible name. */}
      {shown
        ? relationKinds.map((kind) => (
            <div className="flex items-baseline gap-2" key={kind}>
              <label
                className="w-20 shrink-0 pl-1 text-muted-foreground text-xs"
                htmlFor={`${fieldId}-${kind}`}
              >
                {relationLabels[kind]}
              </label>
              <input
                {...ledgerField(kind)}
                className={ledgerFieldClass}
                disabled={disabled}
                id={`${fieldId}-${kind}`}
                onChange={(event) =>
                  onChange({ ...entry, [kind]: event.target.value })
                }
                placeholder="mit Komma getrennt"
                ref={kind === 'synonyms' ? focusOpened : undefined}
                value={entry[kind] ?? ''}
              />
            </div>
          ))
        : null}
    </>
  );
};

// The left page of the notebook: the word and its example sentence.
export const TermColumn = ({
  entry,
  disabled,
  example,
  targetLabel,
  onChange,
}: ColumnProps & { readonly targetLabel: string }) => (
  <div className="col-start-2 row-start-1 flex min-w-0 flex-col pt-1 pb-2 sm:pr-4">
    <input
      {...ledgerField('target')}
      aria-label={targetLabel}
      className={`${ledgerFieldClass} font-medium`}
      disabled={disabled}
      maxLength={maximumEntryTextLength}
      onChange={(event) =>
        onChange({ ...entry, targetText: event.target.value })
      }
      placeholder={targetLabel}
      value={entry.targetText}
    />
    <textarea
      {...ledgerField('example')}
      {...example.sentenceField}
      aria-label="Beispielsatz"
      className={exampleFieldClass}
      placeholder="Beispielsatz (optional)"
      rows={1}
    />
    <RelationFields disabled={disabled} entry={entry} onChange={onChange} />
  </div>
);

// The right page: the German for the word and for its example sentence.
export const NativeColumn = ({
  entry,
  disabled,
  example,
  onChange,
}: ColumnProps) => (
  <div className="col-start-2 row-start-2 flex min-w-0 flex-col pb-2 sm:col-start-3 sm:row-start-1 sm:border-primary/30 sm:border-l sm:pt-1 sm:pl-4">
    <input
      {...ledgerField('native')}
      aria-label="Deutsch"
      className={ledgerFieldClass}
      disabled={disabled}
      maxLength={maximumEntryTextLength}
      onChange={(event) =>
        onChange({ ...entry, nativeText: event.target.value })
      }
      placeholder="Deutsch"
      value={entry.nativeText}
    />
    {example.sentence === '' ? (
      <Button
        className="w-fit self-start px-1"
        disabled={disabled || example.generating || !example.canGenerate}
        onClick={example.generateExample}
        variant="quiet-muted"
      >
        <SparklesIcon aria-hidden={true} className="size-4" />
        {example.generating ? 'Satz wird erzeugt …' : 'Beispielsatz erzeugen'}
      </Button>
    ) : (
      <textarea
        {...ledgerField('exampleNative')}
        {...example.translationField}
        aria-label="Deutsche Übersetzung des Beispielsatzes"
        className={exampleFieldClass}
        placeholder={
          example.translating
            ? 'Übersetzung wird erzeugt …'
            : 'Deutsche Übersetzung'
        }
        rows={1}
      />
    )}
    <ExampleErrors
      generationError={example.generationError}
      translationError={example.translationError}
    />
  </div>
);
