import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { submitOnEnter } from '../../../shared/ui/submit-on-enter';

export type TermDraft = {
  readonly term: string;
  readonly definition: string;
};

export type SuggestDefinition = (
  term: string,
) => Promise<{ readonly definition: string }>;

type TermDefinitionFieldsProps = {
  readonly draft: TermDraft;
  readonly setDraft: Dispatch<SetStateAction<TermDraft>>;
  readonly busy: boolean;
  readonly termRef: RefObject<HTMLInputElement | null>;
  readonly suggestDefinition: SuggestDefinition;
};

// A term and its definition, with the definition proposed on request once
// the term is typed. A proposal only lands while the term is unchanged and
// the definition still empty, and the hint stays only as long as the
// proposed text does. Enter saves from either field, as it answers in
// practice; Shift+Enter starts a new line of the definition.
export const TermDefinitionFields = ({
  draft,
  setDraft,
  busy,
  termRef,
  suggestDefinition,
}: TermDefinitionFieldsProps) => {
  const definitionRef = useRef<HTMLTextAreaElement>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null);
  const reviewRef = useRef(false);
  const term = draft.term.trim();
  const canSuggest = term !== '' && draft.definition.trim() === '';
  const disabled = busy || suggesting;

  // The fields are disabled while a proposal is fetched, so the definition
  // can only take focus for review once they are enabled again.
  useEffect(() => {
    if (!suggesting && reviewRef.current) {
      reviewRef.current = false;
      definitionRef.current?.focus();
    }
  }, [suggesting]);

  const suggest = async () => {
    setSuggesting(true);
    setSuggestionError(false);
    try {
      const { definition } = await suggestDefinition(term);
      setDraft((current) =>
        current.term.trim() === term && current.definition.trim() === ''
          ? { ...current, definition }
          : current,
      );
      setSuggested(definition);
      reviewRef.current = true;
    } catch {
      setSuggestionError(true);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="grid gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Begriff</span>
        <input
          // biome-ignore lint/a11y/noAutofocus: The form appears on request; the learner asked to type, so the term takes focus.
          autoFocus={true}
          className={fieldOnCardClass}
          disabled={disabled}
          maxLength={maximumEntryTextLength}
          onChange={(event) =>
            setDraft((current) => ({ ...current, term: event.target.value }))
          }
          ref={termRef}
          value={draft.term}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Definition</span>
        <textarea
          className={`${fieldOnCardClass} field-sizing-content min-h-24 resize-none`}
          disabled={disabled}
          maxLength={maximumEntryTextLength}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              definition: event.target.value,
            }))
          }
          onKeyDown={submitOnEnter}
          ref={definitionRef}
          rows={3}
          value={draft.definition}
        />
      </label>
      {canSuggest ? (
        <Button
          className="w-fit"
          disabled={disabled}
          onClick={() => {
            suggest().catch(() => undefined);
          }}
          variant="quiet-muted"
        >
          {suggesting
            ? 'Definition wird vorgeschlagen …'
            : 'Definition vorschlagen'}
        </Button>
      ) : null}
      {suggested !== null && draft.definition === suggested ? (
        <p className="text-muted-foreground text-xs">
          Definition mit KI vorgeschlagen. Prüfe sie vor dem Eintragen.
        </p>
      ) : null}
      {suggestionError ? (
        <p className="text-destructive text-sm" role="alert">
          Die Definition konnte nicht vorgeschlagen werden. Schreib sie selbst
          oder versuche es noch einmal.
        </p>
      ) : null}
    </div>
  );
};
