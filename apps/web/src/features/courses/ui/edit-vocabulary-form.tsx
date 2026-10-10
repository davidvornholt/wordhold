import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type SubmitEvent, useState } from 'react';
import {
  awaitsTranslationFor,
  type ExampleDraft,
  type GeneratedExample,
  matchesGenerationSource,
} from '../../../shared/examples/example-draft';
import { ExampleDraftEditor } from '../../../shared/ui/example-draft-editor';
import {
  editedRelatedWords,
  type RelatedWordListsData,
  relatedWordsText,
} from '../../../shared/vocabulary/related-words';
import type { VocabularyEntry } from '../schemas/course-units';
import type { UpdatedVocabularyEntry } from '../services/vocabulary-entry-service';
import { EditEntryFooter } from './edit-entry-footer';
import { type EntryEditorControl, useEntryEdit } from './entry-actions';
import { wordDuplicate } from './entry-duplicates';
import { RelatedWordFields } from './related-word-fields';
import {
  exampleOf,
  type NewVocabularyEntryDraft,
  quoted,
} from './use-new-vocabulary-entry';
import { type SuggestTranslation, WordPairFields } from './word-pair-fields';

type EditVocabularyFormProps = {
  readonly entry: VocabularyEntry;
  readonly control: EntryEditorControl;
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  // Every entry of the course, which the corrected word is checked against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly updateEntry: (
    draft: NewVocabularyEntryDraft & RelatedWordListsData,
  ) => Promise<UpdatedVocabularyEntry>;
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly suggestTranslation: SuggestTranslation;
};

const storedDraft = (entry: VocabularyEntry): ExampleDraft => ({
  targetText: entry.targetText,
  nativeText: entry.nativeText,
  example: entry.example?.targetText ?? '',
  exampleNativeText: entry.example?.nativeText ?? '',
  exampleGenerated: entry.example?.source === 'generated' ? true : undefined,
  exampleStored: entry.example === null ? undefined : true,
});

const savedNotice = (targetText: string, updated: UpdatedVocabularyEntry) =>
  updated.audio === 'failed'
    ? `${quoted(targetText)} gespeichert. Die Aussprache konnte nicht erzeugt werden.`
    : `${quoted(targetText)} gespeichert.`;

// A word, its translation, its example sentence and its synonyms and
// antonyms, as stored, to correct.
// Like a typed word, an exact repeat of another stored word is stopped here
// and a variant is pointed out.
export const EditVocabularyForm = ({
  entry,
  control,
  targetLabel,
  targetLanguage,
  entries,
  updateEntry,
  generateExample,
  translateExample,
  suggestTranslation,
}: EditVocabularyFormProps) => {
  const [draft, setDraft] = useState(() => storedDraft(entry));
  const [relatedWords, setRelatedWords] = useState(() => ({
    synonyms: relatedWordsText(entry.synonyms),
    antonyms: relatedWordsText(entry.antonyms),
  }));
  const { busy, error, firstFieldRef, save } = useEntryEdit(
    control,
    'Die Vokabel wurde nicht gespeichert. Versuche es noch einmal.',
  );
  const targetText = draft.targetText.trim();
  const nativeText = draft.nativeText.trim();
  const duplicate = wordDuplicate(entries, draft, entry.id);
  const submittable =
    !busy && targetText !== '' && nativeText !== '' && !duplicate.blocked;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      save(async () =>
        savedNotice(
          targetText,
          await updateEntry({
            targetText,
            nativeText,
            example: exampleOf(draft),
            synonyms: editedRelatedWords(entry.synonyms, relatedWords.synonyms),
            antonyms: editedRelatedWords(entry.antonyms, relatedWords.antonyms),
          }),
        ),
      ).catch(() => undefined);
    }
  };

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <WordPairFields
        busy={busy}
        draft={draft}
        reviewStep="Speichern"
        setDraft={setDraft}
        suggestTranslation={suggestTranslation}
        targetLabel={targetLabel}
        targetLanguage={targetLanguage}
        targetRef={firstFieldRef}
      />
      {duplicate.hint === null ? null : (
        <p className="text-sm text-warning-foreground">{duplicate.hint}</p>
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
              ? {
                  ...current,
                  exampleNativeText: native,
                  exampleStored: undefined,
                }
              : current,
          )
        }
        reviewStep="Speichern"
        translate={translateExample}
        variant="form"
      />
      <RelatedWordFields
        disabled={busy}
        onChange={setRelatedWords}
        texts={relatedWords}
      />
      <EditEntryFooter
        busy={busy}
        error={error}
        onCancel={control.onCancel}
        submittable={submittable}
      />
    </form>
  );
};
