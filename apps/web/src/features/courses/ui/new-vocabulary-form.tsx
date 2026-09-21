import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { SubmitEvent } from 'react';
import {
  awaitsTranslationFor,
  type GeneratedExample,
  matchesGenerationSource,
} from '../../../shared/examples/example-draft';
import { Button } from '../../../shared/ui/button';
import { ExampleDraftEditor } from '../../../shared/ui/example-draft-editor';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { cardCompactClass } from '../../../shared/ui/surface-styles';
import {
  type DuplicateVerdict,
  duplicateVerdict,
} from '../../../shared/vocabulary/entry-identity';
import type { VocabularyEntry } from '../schemas/course-units';
import type { CreatedVocabularyEntry } from '../services/vocabulary-entry-service';
import {
  type NewVocabularyEntryDraft,
  quoted,
  useNewVocabularyEntry,
} from './use-new-vocabulary-entry';

type NewVocabularyFormProps = {
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  // The unit's stored entries, so a repeat is pointed out while typing.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly createEntry: (
    draft: NewVocabularyEntryDraft,
  ) => Promise<CreatedVocabularyEntry>;
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
};

const duplicateHint = (
  verdict: DuplicateVerdict,
  targetText: string,
): string | null => {
  switch (verdict) {
    case 'exact':
      return `${quoted(targetText)} ist schon in dieser Einheit.`;
    case 'exception':
      return `${quoted(targetText)} ist schon in dieser Einheit, mit anderer Schreibweise oder anderem Beispielsatz.`;
    default:
      return null;
  }
};

// One word at a time, for as long as the form stays open. An exact repeat
// of a stored word is stopped here; a variant is pointed out and left to
// the learner, who typed it on purpose.
export const NewVocabularyForm = ({
  targetLabel,
  targetLanguage,
  entries,
  createEntry,
  generateExample,
  translateExample,
}: NewVocabularyFormProps) => {
  const { draft, setDraft, busy, failed, status, targetRef, save } =
    useNewVocabularyEntry(createEntry);
  const targetText = draft.targetText.trim();
  const complete = targetText !== '' && draft.nativeText.trim() !== '';
  const verdict = duplicateVerdict(
    { targetText, example: draft.example },
    entries.map((entry) => ({
      targetText: entry.targetText,
      examples: entry.example === null ? [] : [entry.example.targetText],
    })),
  );
  const hint = duplicateHint(verdict, targetText);
  const submittable = !busy && complete && verdict !== 'exact';

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      save().catch(() => undefined);
    }
  };

  return (
    <form className={`${cardCompactClass} grid gap-3`} onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{targetLabel}</span>
          <input
            // biome-ignore lint/a11y/noAutofocus: The form appears on request; the learner asked to type, so the first field takes focus.
            autoFocus={true}
            className={fieldOnCardClass}
            disabled={busy}
            lang={targetLanguage}
            maxLength={maximumEntryTextLength}
            onChange={(event) =>
              setDraft({ ...draft, targetText: event.target.value })
            }
            ref={targetRef}
            value={draft.targetText}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Deutsch</span>
          <input
            className={fieldOnCardClass}
            disabled={busy}
            maxLength={maximumEntryTextLength}
            onChange={(event) =>
              setDraft({ ...draft, nativeText: event.target.value })
            }
            value={draft.nativeText}
          />
        </label>
      </div>
      {hint === null ? null : (
        <p className="text-sm text-warning-foreground">{hint}</p>
      )}
      <ExampleDraftEditor
        disabled={busy}
        entry={draft}
        generate={generateExample}
        onChange={setDraft}
        onGenerated={(source, generated) =>
          setDraft((current) =>
            matchesGenerationSource(current, source)
              ? {
                  ...current,
                  example: generated.target,
                  exampleNativeText: generated.native,
                  exampleGenerated: true,
                }
              : current,
          )
        }
        onTranslated={(sentence, native) =>
          setDraft((current) =>
            awaitsTranslationFor(current, sentence)
              ? { ...current, exampleNativeText: native }
              : current,
          )
        }
        reviewStep="Eintragen"
        translate={translateExample}
        variant="form"
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={!submittable} type="submit">
          Eintragen
        </Button>
        <output
          aria-label="Status beim Eintragen einer Vokabel"
          className={failed ? 'text-destructive text-sm' : 'text-sm'}
        >
          {status}
        </output>
      </div>
    </form>
  );
};
