import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type SubmitEvent, useRef } from 'react';
import { courseNouns } from '../../../shared/directions';
import {
  awaitsTranslationFor,
  type GeneratedExample,
  matchesGenerationSource,
} from '../../../shared/examples/example-draft';
import { ExampleDraftEditor } from '../../../shared/ui/example-draft-editor';
import type { VocabularyEntry } from '../schemas/course-units';
import type { CreatedVocabularyEntry } from '../services/vocabulary-entry-service';
import { EntryCard } from './entry-card';
import { wordDuplicate } from './entry-duplicates';
import { missingField, useCloseRequest, useEntryCard } from './use-entry-card';
import {
  emptyDraft,
  exampleOf,
  type NewVocabularyEntryDraft,
  quoted,
} from './vocabulary-entry-draft';
import { type SuggestTranslation, WordPairFields } from './word-pair-fields';

type NewVocabularyFormProps = {
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  // Every stored entry of the course, in any book, so a repeat is pointed out
  // while typing.
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
  readonly suggestTranslation: SuggestTranslation;
};

// One word after another, each on a card of its own. An exact repeat of a
// stored word is stopped here; a variant is pointed out and left to the
// learner, who typed it on purpose.
export const NewVocabularyForm = ({
  targetLabel,
  targetLanguage,
  entries,
  createEntry,
  generateExample,
  translateExample,
  suggestTranslation,
}: NewVocabularyFormProps) => {
  const targetRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const card = useEntryCard(emptyDraft, targetRef);
  const { draft, setDraft, busy } = card;
  const targetText = draft.targetText.trim();
  const nativeText = draft.nativeText.trim();
  const duplicate = wordDuplicate(entries, draft, null);
  const submittable =
    !busy && targetText !== '' && nativeText !== '' && !duplicate.blocked;

  const save = () =>
    card.file({
      pending: `${quoted(targetText)} wird eingetragen …`,
      create: async () => {
        const { audio } = await createEntry({
          targetText,
          nativeText,
          example: exampleOf(draft),
        });
        const pronounced = audio === 'generated';
        return {
          entry: {
            front: targetText,
            back: nativeText,
            frontLang: targetLanguage,
            note: pronounced ? null : 'Ohne Aussprache',
          },
          status: pronounced
            ? `${quoted(targetText)} eingetragen.`
            : `${quoted(targetText)} eingetragen. Die Aussprache konnte nicht erzeugt werden.`,
        };
      },
      fallback: 'Die Vokabel wurde nicht eingetragen. Versuche es noch einmal.',
    });

  const requestClose = useCloseRequest(card, {
    blank:
      targetText === '' &&
      nativeText === '' &&
      draft.example.trim() === '' &&
      draft.exampleNativeText.trim() === '',
    missingRef: missingField([
      [targetText === '' || duplicate.blocked, targetRef],
      [nativeText === '', nativeRef],
    ]),
    notice: 'Diese Vokabel ist noch nicht eingetragen.',
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      save().catch(() => undefined);
    }
  };

  return (
    <EntryCard
      card={card}
      enterFiles={true}
      nouns={courseNouns({ kind: 'language' })}
      onSubmit={submit}
      requestClose={requestClose}
      statusLabel="Status beim Eintragen einer Vokabel"
      submittable={submittable}
    >
      <WordPairFields
        busy={busy}
        draft={draft}
        // While the entry is filed, the list may already hold it, and it
        // would be pointed out as a repeat of itself.
        hint={busy ? null : duplicate.hint}
        nativeRef={nativeRef}
        reviewStep="Eintragen"
        setDraft={setDraft}
        suggestTranslation={suggestTranslation}
        targetLabel={targetLabel}
        targetLanguage={targetLanguage}
        targetRef={targetRef}
      />
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
        targetLanguage={targetLanguage}
        translate={translateExample}
      />
    </EntryCard>
  );
};
