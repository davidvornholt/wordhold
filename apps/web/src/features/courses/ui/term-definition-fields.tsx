import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  entryTextLineClass,
  entryWordLineClass,
} from '../../../shared/ui/field-styles';
import { LineAction, LineWithAction } from '../../../shared/ui/line-action';
import {
  movesOnEnter,
  submitOnEnter,
} from '../../../shared/ui/submit-on-enter';

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
  // Names the step the learner reviews the AI text before, e.g. "Eintragen".
  readonly reviewStep: string;
  readonly termRef: RefObject<HTMLInputElement | null>;
  readonly definitionRef: RefObject<HTMLTextAreaElement | null>;
  // A note on the typed term, such as that it repeats a stored one.
  readonly hint: string | null;
  readonly suggestDefinition: SuggestDefinition;
};

// A term and its definition, written on a card like an answer in practice:
// the term on a line of its own and the definition on a line that grows as
// it is written. Enter on the term moves to the definition while it is
// empty, and the definition then offers to propose it. A proposal only lands
// while the term is unchanged and the definition still empty, and the hint
// stays only as long as the proposed text does. Enter in the definition
// files the card, as it answers in practice; Shift+Enter starts a new line.
export const TermDefinitionFields = ({
  draft,
  setDraft,
  busy,
  reviewStep,
  termRef,
  definitionRef,
  hint,
  suggestDefinition,
}: TermDefinitionFieldsProps) => {
  const id = useId();
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
  }, [suggesting, definitionRef]);

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="eyebrow" htmlFor={`${id}-term`}>
          Begriff
        </label>
        <input
          // biome-ignore lint/a11y/noAutofocus: The form appears on request; the learner asked to type, so the term takes focus.
          autoFocus={true}
          className={entryWordLineClass}
          disabled={disabled}
          enterKeyHint={canSuggest ? 'next' : undefined}
          id={`${id}-term`}
          maxLength={maximumEntryTextLength}
          onChange={(event) =>
            setDraft((current) => ({ ...current, term: event.target.value }))
          }
          onKeyDown={(event) => {
            if (canSuggest && movesOnEnter(event)) {
              event.preventDefault();
              definitionRef.current?.focus();
            }
          }}
          ref={termRef}
          value={draft.term}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="eyebrow" htmlFor={`${id}-definition`}>
          Definition
        </label>
        <LineWithAction
          action={
            canSuggest ? (
              <LineAction
                align="start"
                aria-label={
                  suggesting
                    ? 'Definition wird vorgeschlagen …'
                    : 'Definition vorschlagen'
                }
                disabled={disabled}
                onClick={() => {
                  suggest().catch(() => undefined);
                }}
              >
                {suggesting ? 'Wird vorgeschlagen …' : 'Vorschlagen'}
              </LineAction>
            ) : null
          }
          line={
            <textarea
              className={`${entryTextLineClass} field-sizing-content resize-none`}
              disabled={disabled}
              id={`${id}-definition`}
              maxLength={maximumEntryTextLength}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  definition: event.target.value,
                }))
              }
              onKeyDown={submitOnEnter}
              ref={definitionRef}
              rows={1}
              value={draft.definition}
            />
          }
        />
        <div className="flex min-h-5 flex-col gap-1 text-sm">
          {hint === null ? null : (
            <p className="text-warning-foreground">{hint}</p>
          )}
          {suggested !== null && draft.definition === suggested ? (
            <p className="text-muted-foreground text-xs">
              KI-Vorschlag. Prüfe ihn vor dem {reviewStep}.
            </p>
          ) : null}
          {suggestionError ? (
            <p className="text-destructive" role="alert">
              Die Definition konnte nicht vorgeschlagen werden. Schreib sie
              selbst oder versuche es noch einmal.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
