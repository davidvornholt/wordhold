import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ExampleDraft } from '../../../shared/examples/example-draft';
import { Button } from '../../../shared/ui/button';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';

export type WordSide = 'target' | 'native';

export type SuggestTranslation = (
  text: string,
  given: WordSide,
) => Promise<{ readonly translation: string }>;

type WordPairFieldsProps = {
  readonly draft: ExampleDraft;
  readonly setDraft: Dispatch<SetStateAction<ExampleDraft>>;
  readonly busy: boolean;
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  readonly targetRef: RefObject<HTMLInputElement | null>;
  readonly suggestTranslation: SuggestTranslation;
};

const fieldOf = { target: 'targetText', native: 'nativeText' } as const;
const otherSide = { target: 'native', native: 'target' } as const;

const filledSide = (draft: ExampleDraft): WordSide | null => {
  const hasTarget = draft.targetText.trim() !== '';
  const hasNative = draft.nativeText.trim() !== '';
  if (hasTarget === hasNative) {
    return null;
  }
  return hasTarget ? 'target' : 'native';
};

// The word pair, with the missing side proposed on request: type either
// side, ask, review the proposal in the other field. A proposal only lands
// while the typed side is unchanged and the other still empty, and the
// hint stays only as long as the proposed text does.
export const WordPairFields = ({
  draft,
  setDraft,
  busy,
  targetLabel,
  targetLanguage,
  targetRef,
  suggestTranslation,
}: WordPairFieldsProps) => {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [suggested, setSuggested] = useState<{
    readonly side: WordSide;
    readonly text: string;
  } | null>(null);
  const refs = { target: targetRef, native: nativeRef } as const;
  const reviewRef = useRef<WordSide | null>(null);
  const givenSide = filledSide(draft);

  // The fields are disabled while a proposal is fetched, so the proposed
  // side can only take focus for review once they are enabled again.
  useEffect(() => {
    const side = reviewRef.current;
    if (!suggesting && side !== null) {
      reviewRef.current = null;
      (side === 'target' ? targetRef : nativeRef).current?.focus();
    }
  }, [suggesting, targetRef]);
  const showHint =
    suggested !== null && draft[fieldOf[suggested.side]] === suggested.text;

  const suggest = async (given: WordSide) => {
    const text = draft[fieldOf[given]].trim();
    const side = otherSide[given];
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

  const field = (side: WordSide, label: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        // biome-ignore lint/a11y/noAutofocus: The form appears on request; the learner asked to type, so the first field takes focus.
        autoFocus={side === 'target'}
        className={fieldOnCardClass}
        disabled={busy || suggesting}
        lang={side === 'target' ? targetLanguage : undefined}
        maxLength={maximumEntryTextLength}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [fieldOf[side]]: event.target.value,
          }))
        }
        ref={refs[side]}
        value={draft[fieldOf[side]]}
      />
    </label>
  );

  return (
    <div className="grid gap-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('target', targetLabel)}
        {field('native', 'Deutsch')}
      </div>
      {givenSide === null ? null : (
        <Button
          className="w-fit"
          disabled={busy || suggesting}
          onClick={() => {
            suggest(givenSide).catch(() => undefined);
          }}
          variant="quiet-muted"
        >
          {suggesting
            ? 'Übersetzung wird vorgeschlagen …'
            : 'Übersetzung vorschlagen'}
        </Button>
      )}
      {showHint ? (
        <p className="text-muted-foreground text-xs">
          Übersetzung mit KI vorgeschlagen. Prüfe sie vor dem Eintragen.
        </p>
      ) : null}
      {suggestionError ? (
        <p className="text-destructive text-sm" role="alert">
          Die Übersetzung konnte nicht vorgeschlagen werden. Trage sie ein oder
          versuche es noch einmal.
        </p>
      ) : null}
    </div>
  );
};
