import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useId, useState } from 'react';
import type { GeneratedExample } from '../../../shared/examples/example-draft';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';
import type { CreatedVocabularyEntry } from '../services/vocabulary-entry-service';
import { NewVocabularyForm } from './new-vocabulary-form';
import { UnitVocabularyEmpty } from './unit-vocabulary-empty';
import type { NewVocabularyEntryDraft } from './use-new-vocabulary-entry';
import { VocabularyLibrary } from './vocabulary-library';
import type { SuggestTranslation } from './word-pair-fields';

type UnitVocabularyProps = {
  readonly entries: ReadonlyArray<VocabularyEntry>;
  // Every entry of the course, which a typed word is checked against.
  readonly courseEntries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly targetLanguage: LanguageCode;
  readonly targetLabel: string;
  readonly importAction: ReactNode;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly generateExample: (
    entryId: string,
  ) => Promise<NonNullable<VocabularyEntry['example']>>;
  readonly createEntry: (
    draft: NewVocabularyEntryDraft,
  ) => Promise<CreatedVocabularyEntry>;
  readonly generateDraftExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateDraftExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly suggestTranslation: SuggestTranslation;
};

// The unit's vocabulary with the one way to grow it by hand. The form sits
// under the heading, above the list, and stays open until the learner is
// done, so several words can be typed in a row and appear below as they are
// saved. An empty unit offers typing next to photographing.
export const UnitVocabulary = ({
  entries,
  courseEntries,
  enabledDirections,
  targetLanguage,
  targetLabel,
  importAction,
  renderStudyAction,
  generateExample,
  createEntry,
  generateDraftExample,
  translateDraftExample,
  suggestTranslation,
}: UnitVocabularyProps) => {
  const [adding, setAdding] = useState(false);
  const headingId = useId();
  const isEmpty = entries.length === 0;
  const form = adding ? (
    <NewVocabularyForm
      createEntry={createEntry}
      entries={courseEntries}
      generateExample={generateDraftExample}
      suggestTranslation={suggestTranslation}
      targetLabel={targetLabel}
      targetLanguage={targetLanguage}
      translateExample={translateDraftExample}
    />
  ) : null;
  let content: ReactNode = null;
  if (!isEmpty) {
    content = (
      <VocabularyLibrary
        enabledDirections={enabledDirections}
        entries={entries}
        generateExample={generateExample}
        initialFilter="all"
        renderStudyAction={renderStudyAction}
        scope="unit"
        targetLanguage={targetLanguage}
      />
    );
  } else if (!adding) {
    content = (
      <UnitVocabularyEmpty
        addAction={
          <Button onClick={() => setAdding(true)} variant="outline">
            Vokabel eintragen
          </Button>
        }
        importAction={importAction}
      />
    );
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          {isEmpty ? 'Vokabeln hinzufügen' : 'Vokabeln'}
        </h2>
        {isEmpty && !adding ? null : (
          <Button
            aria-expanded={adding}
            onClick={() => setAdding((current) => !current)}
            variant="quiet-muted"
          >
            {adding ? 'Fertig' : 'Vokabel eintragen'}
          </Button>
        )}
      </div>
      {form}
      {content}
    </section>
  );
};
