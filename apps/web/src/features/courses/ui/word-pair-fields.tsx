import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { ExampleDraft } from '../../../shared/examples/example-draft';
import { entryWordLineClass } from '../../../shared/ui/field-styles';
import { LineAction, LineWithAction } from '../../../shared/ui/line-action';
import { movesOnEnter } from '../../../shared/ui/submit-on-enter';

export type WordSide = 'target' | 'native';

export type SuggestTranslation = (
  text: string,
  given: WordSide,
) => Promise<{ readonly translation: string }>;

type WordPairFieldsProps = {
  readonly draft: ExampleDraft;
  readonly setDraft: Dispatch<SetStateAction<ExampleDraft>>;
  readonly busy: boolean;
  // Names the step the learner reviews the AI text before, e.g. "Eintragen".
  readonly reviewStep: string;
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  readonly targetRef: RefObject<HTMLInputElement | null>;
  readonly nativeRef: RefObject<HTMLInputElement | null>;
  // A note on the typed word, such as that it repeats a stored one.
  readonly hint: string | null;
  readonly suggestTranslation: SuggestTranslation;
};

const fieldOf = { target: 'targetText', native: 'nativeText' } as const;
const otherSide = { target: 'native', native: 'target' } as const;

const filled = (draft: ExampleDraft, side: WordSide) =>
  draft[fieldOf[side]].trim() !== '';

const ProposeTranslation = ({
  suggesting,
  disabled,
  onClick,
}: {
  readonly suggesting: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) => (
  <LineAction
    aria-label={
      suggesting
        ? 'Übersetzung wird vorgeschlagen …'
        : 'Übersetzung vorschlagen'
    }
    disabled={disabled}
    onClick={onClick}
  >
    {suggesting ? 'Wird vorgeschlagen …' : 'Vorschlagen'}
  </LineAction>
);

// The word pair, written on two lines like the front and back of an index
// card. Enter on the one side written moves to the other, which offers to
// propose it: type either side, ask, review the proposal. A proposal only
// lands while the typed side is unchanged and the other still empty, and
// the hint stays only as long as the proposed text does. With both sides
// written, Enter files the card.
export const WordPairFields = ({
  draft,
  setDraft,
  busy,
  reviewStep,
  targetLabel,
  targetLanguage,
  targetRef,
  nativeRef,
  hint,
  suggestTranslation,
}: WordPairFieldsProps) => {
  const id = useId();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [suggested, setSuggested] = useState<{
    readonly side: WordSide;
    readonly text: string;
  } | null>(null);
  const refs = { target: targetRef, native: nativeRef } as const;
  const reviewRef = useRef<WordSide | null>(null);

  // The fields are disabled while a proposal is fetched, so the proposed
  // side can only take focus for review once they are enabled again.
  useEffect(() => {
    const side = reviewRef.current;
    if (!suggesting && side !== null) {
      reviewRef.current = null;
      (side === 'target' ? targetRef : nativeRef).current?.focus();
    }
  }, [suggesting, targetRef, nativeRef]);
  const showHint =
    suggested !== null && draft[fieldOf[suggested.side]] === suggested.text;

  const suggest = async (side: WordSide) => {
    const given = otherSide[side];
    const text = draft[fieldOf[given]].trim();
    setSuggesting(true);
    setSuggestionError(false);
    try {
      const { translation } = await suggestTranslation(text, given);
      setDraft((current) =>
        current[fieldOf[given]].trim() === text &&
        current[fieldOf[side]].trim() === ''
          ? { ...current, [fieldOf[side]]: translation }
          : current,
      );
      setSuggested({ side, text: translation });
      reviewRef.current = side;
    } catch {
      setSuggestionError(true);
    } finally {
      setSuggesting(false);
    }
  };

  const field = (side: WordSide, label: string) => {
    const fieldId = `${id}-${side}`;
    const other = otherSide[side];
    const moves = filled(draft, side) && !filled(draft, other);
    const proposable = !filled(draft, side) && filled(draft, other);
    return (
      <div className="flex flex-col gap-1">
        <label className="eyebrow" htmlFor={fieldId}>
          {label}
        </label>
        <LineWithAction
          action={
            proposable ? (
              <ProposeTranslation
                disabled={busy || suggesting}
                onClick={() => {
                  suggest(side).catch(() => undefined);
                }}
                suggesting={suggesting}
              />
            ) : null
          }
          line={
            <input
              // biome-ignore lint/a11y/noAutofocus: The form appears on request; the learner asked to type, so the first field takes focus.
              autoFocus={side === 'target'}
              className={entryWordLineClass}
              disabled={busy || suggesting}
              enterKeyHint={moves ? 'next' : undefined}
              id={fieldId}
              lang={side === 'target' ? targetLanguage : undefined}
              maxLength={maximumEntryTextLength}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [fieldOf[side]]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (moves && movesOnEnter(event)) {
                  event.preventDefault();
                  refs[other].current?.focus();
                }
              }}
              ref={refs[side]}
              value={draft[fieldOf[side]]}
            />
          }
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {field('target', targetLabel)}
        {field('native', 'Deutsch')}
      </div>
      <div className="flex min-h-5 flex-col gap-1 text-sm">
        {hint === null ? null : (
          <p className="text-warning-foreground">{hint}</p>
        )}
        {showHint ? (
          <p className="text-muted-foreground text-xs">
            Übersetzung mit KI vorgeschlagen. Prüfe sie vor dem {reviewStep}.
          </p>
        ) : null}
        {suggestionError ? (
          <p className="text-destructive" role="alert">
            Die Übersetzung konnte nicht vorgeschlagen werden. Trage sie ein
            oder versuche es noch einmal.
          </p>
        ) : null}
      </div>
    </div>
  );
};
