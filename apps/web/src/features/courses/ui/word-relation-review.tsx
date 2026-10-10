import { maximumRelatedWords } from '@wordhold/ai/extraction/schema';
import { maximumRelationBatch } from '@wordhold/ai/relations/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { useId, useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { germanLabels } from '../../../shared/languages';
import { Button } from '../../../shared/ui/button';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import {
  type RelationKind,
  relationKinds,
  relationLabels,
} from '../../../shared/vocabulary/related-words';
import type {
  SaveWordRelationsData,
  SuggestedWordRelations,
} from '../schemas/word-relations';
import {
  changedRelations,
  type RelationDraft,
  type RelationDrafts,
  type RelationWord,
  relationDraft,
  settledDrafts,
  tooManyRelatedWords,
  withSuggestions,
  wordsToSuggest,
} from './word-relation-drafts';

type RelationFieldProps = {
  readonly kind: RelationKind;
  readonly word: RelationWord;
  readonly draft: RelationDraft;
  readonly targetLanguage: LanguageCode;
  readonly disabled: boolean;
  readonly onChange: (text: string) => void;
};

const RelationField = ({
  kind,
  word,
  draft,
  targetLanguage,
  disabled,
  onChange,
}: RelationFieldProps) => {
  const fieldId = useId();
  const noteId = useId();
  const text = draft.texts[kind];
  const tooMany = tooManyRelatedWords(text);
  let note: string | null = null;
  if (tooMany) {
    note = `Höchstens ${maximumRelatedWords} Wörter.`;
  } else if (draft.suggested[kind]) {
    note =
      text.trim() === ''
        ? 'Kein passendes Wort vorgeschlagen.'
        : 'Vorschlag – bitte prüfen.';
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm" htmlFor={fieldId}>
        {relationLabels[kind]}
        <span className="sr-only"> zu {word.targetText}</span>
      </label>
      <input
        aria-describedby={note === null ? undefined : noteId}
        aria-invalid={tooMany}
        className={fieldOnCardClass}
        disabled={disabled}
        id={fieldId}
        lang={targetLanguage}
        onChange={(event) => onChange(event.target.value)}
        value={text}
      />
      {note === null ? null : (
        <p
          className={`text-xs ${tooMany ? 'text-destructive' : 'text-muted-foreground'}`}
          id={noteId}
        >
          {note}
        </p>
      )}
    </div>
  );
};

type RelationRowProps = {
  readonly word: RelationWord;
  readonly draft: RelationDraft;
  readonly targetLanguage: LanguageCode;
  readonly disabled: boolean;
  readonly onChange: (kind: RelationKind, text: string) => void;
};

const RelationRow = ({
  word,
  draft,
  targetLanguage,
  disabled,
  onChange,
}: RelationRowProps) => (
  <li className="flex flex-col gap-3 border border-border bg-card p-4">
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium" lang={targetLanguage}>
        {word.targetText}
      </span>
      <span className="text-muted-foreground text-sm">{word.nativeText}</span>
    </p>
    <div className="grid gap-3 sm:grid-cols-2">
      {relationKinds.map((kind) => (
        <RelationField
          disabled={disabled}
          draft={draft}
          key={kind}
          kind={kind}
          onChange={(text) => onChange(kind, text)}
          targetLanguage={targetLanguage}
          word={word}
        />
      ))}
    </div>
  </li>
);

// One suggestion request at a time per lane, three lanes, as when example
// sentences are made for a whole page.
const lanes = 3;

const batches = (ids: ReadonlyArray<string>) =>
  Array.from(
    { length: Math.ceil(ids.length / maximumRelationBatch) },
    (_, index) =>
      ids.slice(
        index * maximumRelationBatch,
        (index + 1) * maximumRelationBatch,
      ),
  );

type SuggestRelations = (
  entryIds: ReadonlyArray<string>,
) => Promise<ReadonlyArray<SuggestedWordRelations>>;

// Asks for the given words in batches. Each batch lands as it arrives; a
// failed batch is counted and the rest go on.
const useRelationSuggestions = (
  suggest: SuggestRelations,
  onSuggested: (suggestions: ReadonlyArray<SuggestedWordRelations>) => void,
) => {
  const [progress, setProgress] = useState<{
    readonly done: number;
    readonly total: number;
  } | null>(null);
  const [failed, setFailed] = useState(0);

  const suggestFor = async (entryIds: ReadonlyArray<string>) => {
    const queue = batches(entryIds);
    let done = 0;
    let failures = 0;
    setFailed(0);
    setProgress({ done, total: entryIds.length });
    const lane = async () => {
      for (
        let batch = queue.shift();
        batch !== undefined;
        batch = queue.shift()
      ) {
        try {
          // biome-ignore lint/performance/noAwaitInLoops: Sequential within a lane on purpose; lanes run in parallel.
          onSuggested(await suggest(batch));
        } catch {
          failures += batch.length;
        }
        done += batch.length;
        setProgress({ done, total: entryIds.length });
      }
    };
    await Promise.all(Array.from({ length: lanes }, lane));
    setFailed(failures);
    setProgress(null);
  };

  return { progress, failed, suggestFor };
};

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

type RelationSaveBarProps = {
  readonly changed: number;
  readonly state: SaveState;
  readonly disabled: boolean;
  readonly onSave: () => void;
};

// Floats above the list edge while something is unsaved, so saving stays
// reachable however long the list grows.
const RelationSaveBar = ({
  changed,
  state,
  disabled,
  onSave,
}: RelationSaveBarProps) => (
  <div
    className={`flex flex-wrap items-center justify-between gap-3 border bg-card p-4 ${
      changed > 0 || state === 'failed'
        ? 'sticky bottom-4 border-primary shadow-lg'
        : 'border-border'
    }`}
  >
    <div className="flex flex-col gap-1 text-sm">
      {state === 'saved' ? null : (
        <p>
          {changed === 0
            ? 'Keine ungespeicherten Änderungen'
            : `${countNoun(changed, 'Wort', 'Wörter')} geändert`}
        </p>
      )}
      <p aria-live="polite">{state === 'saved' ? 'Gespeichert.' : ''}</p>
      {state === 'failed' ? (
        <p className="text-destructive" role="alert">
          Die Änderungen konnten nicht gespeichert werden. Versuche es noch
          einmal.
        </p>
      ) : null}
    </div>
    <Button disabled={disabled || changed === 0} onClick={onSave}>
      {state === 'saving' ? 'Wird gespeichert …' : 'Speichern'}
    </Button>
  </div>
);

type WordRelationReviewProps = {
  readonly words: ReadonlyArray<RelationWord>;
  readonly targetLanguage: LanguageCode;
  readonly suggest: SuggestRelations;
  readonly save: (words: SaveWordRelationsData['words']) => Promise<unknown>;
  // Reloads the stored lists once a save went through.
  readonly onSaved: () => Promise<void>;
};

// The synonyms and antonyms of one book's own words or one unit. Suggestions
// fill only the lists nothing settled yet and stay unsaved until the learner
// saves the screen.
export const WordRelationReview = ({
  words,
  targetLanguage,
  suggest,
  save,
  onSaved,
}: WordRelationReviewProps) => {
  const [drafts, setDrafts] = useState<RelationDrafts>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { progress, failed, suggestFor } = useRelationSuggestions(
    suggest,
    (suggestions) =>
      setDrafts((current) => withSuggestions(words, current, suggestions)),
  );
  const open = wordsToSuggest(words, drafts);
  const changes = changedRelations(words, drafts);
  const invalid = words.some((word) =>
    relationKinds.some((kind) =>
      tooManyRelatedWords(relationDraft(drafts, word).texts[kind]),
    ),
  );
  const saving = saveState === 'saving';
  const progressText =
    progress === null
      ? ''
      : `Vorschläge werden erzeugt … ${progress.done} von ${countNoun(progress.total, 'Wort', 'Wörtern')}`;

  const saveChanges = async () => {
    setSaveState('saving');
    try {
      await save(changes);
      await onSaved();
      setDrafts(settledDrafts);
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  };

  const updateText = (word: RelationWord, kind: RelationKind, text: string) => {
    setSaveState('idle');
    setDrafts((current) => {
      const draft = relationDraft(current, word);
      return {
        ...current,
        [word.id]: { ...draft, texts: { ...draft.texts, [kind]: text } },
      };
    });
  };

  if (words.length === 0) {
    return (
      <p className="text-muted-foreground">Hier gibt es noch keine Wörter.</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        Trage zu jedem Wort Synonyme und Gegenteile auf{' '}
        {germanLabels[targetLanguage]} ein, mit Komma getrennt. Was auf der
        fotografierten Seite stand, ist schon eingetragen. Vorschläge werden
        erst gespeichert, wenn du speicherst.
      </p>
      {progress === null && open.length === 0 && failed === 0 ? null : (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {progress === null ? null : (
            <p className="text-muted-foreground">{progressText}</p>
          )}
          {progress !== null || open.length === 0 ? null : (
            <>
              <span className="text-muted-foreground">
                Bei {countNoun(open.length, 'Wort', 'Wörtern')} fehlen Synonyme
                oder Gegenteile.
              </span>
              <Button
                disabled={saving}
                onClick={() => {
                  suggestFor(open.map((word) => word.id)).catch(
                    () => undefined,
                  );
                }}
                variant="outline"
              >
                Fehlende vorschlagen
              </Button>
            </>
          )}
          {failed === 0 ? null : (
            <p className="text-destructive" role="alert">
              Für {countNoun(failed, 'Wort', 'Wörter')} konnte nichts
              vorgeschlagen werden. Versuche es noch einmal.
            </p>
          )}
        </div>
      )}
      {/* Present from the start, so the progress is announced as it changes. */}
      <p aria-live="polite" className="sr-only">
        {progressText}
      </p>
      <ul className="flex flex-col gap-3">
        {words.map((word) => (
          <RelationRow
            disabled={saving}
            draft={relationDraft(drafts, word)}
            key={word.id}
            onChange={(kind, text) => updateText(word, kind, text)}
            targetLanguage={targetLanguage}
            word={word}
          />
        ))}
      </ul>
      <RelationSaveBar
        changed={changes.length}
        disabled={invalid || saving || progress !== null}
        onSave={() => {
          saveChanges().catch(() => undefined);
        }}
        state={saveState}
      />
    </div>
  );
};
