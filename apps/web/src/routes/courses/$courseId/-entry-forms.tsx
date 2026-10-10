import { useRouter } from '@tanstack/react-router';
import type { BibleSummary } from '../../../features/bibles/schemas/bible-models';
import { lookUpBiblePassage } from '../../../features/bibles/services/server-fns';
import type { VocabularyEntry } from '../../../features/courses/schemas/course-units';
import {
  createVocabularyEntry,
  deleteCourseEntry,
  generateVocabularyDraftExample,
  generateVocabularyExample,
  suggestVocabularyTranslation,
  translateVocabularyDraftExample,
  updateVocabularyEntry,
} from '../../../features/courses/services/server-fns';
import {
  createTermEntry,
  deriveTermKeyPoints,
  suggestTermDefinition,
  updateTermEntry,
  updateTermKeyPoints,
} from '../../../features/courses/services/term-server-fns';
import {
  createTextEntry,
  updateTextEntry,
} from '../../../features/courses/services/text-server-fns';
import { EditTermForm } from '../../../features/courses/ui/edit-term-form';
import { EditVocabularyForm } from '../../../features/courses/ui/edit-vocabulary-form';
import type {
  CourseEntryActions,
  EntryEditorControl,
} from '../../../features/courses/ui/entry-actions';
import { NewTermForm } from '../../../features/courses/ui/new-term-form';
import { NewVocabularyForm } from '../../../features/courses/ui/new-vocabulary-form';
import { RelatedWordsSummary } from '../../../features/courses/ui/related-words-summary';
import { TermKeyPoints } from '../../../features/courses/ui/term-key-points';
import {
  EditTextForm,
  NewTextForm,
} from '../../../features/courses/ui/text-entry-forms';
import { VocabularyExample } from '../../../features/courses/ui/vocabulary-example';
import type { WordPlace } from '../../../features/courses/ui/word-places';
import type { CourseSubject } from '../../../shared/directions';
import { germanLabels } from '../../../shared/languages';

export type EntryCourse = CourseSubject & { readonly id: string };

type ListEntryFormProps = {
  readonly course: EntryCourse;
  // Every entry of the subject or collection, which a typed term or title is
  // checked against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
};

// Typing a term with its definition into a subject. Each saved term refreshes
// the loader so the page's counts and list include it. Its key points are
// derived after it is saved, without holding up the next term; practice
// derives them itself if that has not finished.
export const TermEntryForm = ({ course, entries }: ListEntryFormProps) => {
  const router = useRouter();
  const courseId = course.id;
  return (
    <NewTermForm
      createEntry={async (draft) => {
        const { entryId } = await createTermEntry({
          data: { courseId, ...draft },
        });
        deriveTermKeyPoints({ data: { courseId, entryId } })
          .then(() => router.invalidate())
          .catch(() => undefined);
        await router.invalidate();
      }}
      entries={entries}
      suggestDefinition={(term) =>
        suggestTermDefinition({ data: { courseId, term } })
      }
    />
  );
};

type TextEntryFormProps = ListEntryFormProps & {
  // The Bibles the learner uploaded, which a typed reference is looked up in.
  readonly bibles: ReadonlyArray<BibleSummary>;
};

// Typing a title with its text into a collection. Each saved text refreshes
// the loader so the page's counts and list include it.
export const TextEntryForm = ({
  course,
  entries,
  bibles,
}: TextEntryFormProps) => {
  const router = useRouter();
  const courseId = course.id;
  return (
    <NewTextForm
      createEntry={async (draft) => {
        await createTextEntry({ data: { courseId, ...draft } });
        await router.invalidate();
      }}
      entries={entries}
      lookup={
        bibles.length === 0
          ? null
          : {
              sources: bibles.map(({ id, abbreviation }) => ({
                id,
                label: abbreviation,
              })),
              lookUp: (reference, bibleId) =>
                lookUpBiblePassage({ data: { bibleId, reference } }),
            }
      }
    />
  );
};

type VocabularyEntryFormProps = {
  readonly course: EntryCourse;
  readonly place: WordPlace;
  // Every entry of the course, which a typed word is checked against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
};

// Typing a word with its translation and example into a book or unit. Each
// saved word refreshes the loader so the page's counts and lists include it.
export const VocabularyEntryForm = ({
  course,
  place,
  entries,
}: VocabularyEntryFormProps) => {
  const router = useRouter();
  const courseId = course.id;
  return (
    <NewVocabularyForm
      createEntry={async (draft) => {
        const created = await createVocabularyEntry({
          data: { courseId, ...place, ...draft },
        });
        await router.invalidate();
        return created;
      }}
      entries={entries}
      generateExample={(targetText, nativeText) =>
        generateVocabularyDraftExample({
          data: { courseId, targetText, nativeText },
        })
      }
      suggestTranslation={(text, given) =>
        suggestVocabularyTranslation({
          data: { courseId, ...place, text, given },
        })
      }
      targetLabel={germanLabels[course.targetLanguage]}
      targetLanguage={course.targetLanguage}
      translateExample={(targetText) =>
        translateVocabularyDraftExample({ data: { courseId, targetText } })
      }
    />
  );
};

type CourseEntryDetailProps = {
  readonly course: EntryCourse;
  readonly entry: VocabularyEntry;
};

// What an entry's details show besides its schedule: a word's synonyms,
// antonyms and example sentence, generated on request, or a term's key
// points. Each change
// refreshes the loader, so the details show it when they are opened again.
// A text has nothing besides itself.
const CourseEntryDetail = ({ course, entry }: CourseEntryDetailProps) => {
  const router = useRouter();
  const refreshed = async <Result,>(change: Promise<Result>) => {
    const result = await change;
    await router.invalidate();
    return result;
  };
  if (course.kind === 'texts') {
    return null;
  }
  return course.kind === 'terms' ? (
    <TermKeyPoints
      derive={() =>
        refreshed(
          deriveTermKeyPoints({
            data: { courseId: course.id, entryId: entry.id },
          }),
        )
      }
      keyPoints={entry.keyPoints}
      update={(keyPoints) =>
        refreshed(
          updateTermKeyPoints({
            data: { courseId: course.id, entryId: entry.id, keyPoints },
          }),
        )
      }
    />
  ) : (
    <>
      <RelatedWordsSummary
        lists={entry}
        targetLanguage={course.targetLanguage}
      />
      <VocabularyExample
        entry={entry}
        generate={() =>
          refreshed(generateVocabularyExample({ data: entry.id }))
        }
        targetLanguage={course.targetLanguage}
      />
    </>
  );
};

type CourseEntryEditorProps = {
  readonly course: EntryCourse;
  // The entries a corrected entry is checked against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly entry: VocabularyEntry;
  readonly control: EntryEditorControl;
};

// Correcting a word, term or text from its details. A saved correction
// refreshes the loader before the details are shown again, so they show it.
// A term with a new definition gets its key points derived again in the
// background, as a typed term does.
const CourseEntryEditor = ({
  course,
  entries,
  entry,
  control,
}: CourseEntryEditorProps) => {
  const router = useRouter();
  const courseId = course.id;
  const entryId = entry.id;
  if (course.kind === 'texts') {
    return (
      <EditTextForm
        control={control}
        entries={entries}
        entry={entry}
        updateEntry={async (draft) => {
          await updateTextEntry({ data: { courseId, entryId, ...draft } });
          await router.invalidate();
        }}
      />
    );
  }
  if (course.kind === 'terms') {
    return (
      <EditTermForm
        control={control}
        entries={entries}
        entry={entry}
        suggestDefinition={(term) =>
          suggestTermDefinition({ data: { courseId, term } })
        }
        updateEntry={async (draft) => {
          const { definitionChanged } = await updateTermEntry({
            data: { courseId, entryId, ...draft },
          });
          if (definitionChanged) {
            deriveTermKeyPoints({ data: { courseId, entryId } })
              .then(() => router.invalidate())
              .catch(() => undefined);
          }
          await router.invalidate();
        }}
      />
    );
  }
  return (
    <EditVocabularyForm
      control={control}
      entries={entries}
      entry={entry}
      generateExample={(targetText, nativeText) =>
        generateVocabularyDraftExample({
          data: { courseId, targetText, nativeText },
        })
      }
      suggestTranslation={(text, given) =>
        suggestVocabularyTranslation({
          data: {
            courseId,
            bookId: entry.bookId,
            unitId: entry.unitId,
            text,
            given,
          },
        })
      }
      targetLabel={germanLabels[course.targetLanguage]}
      targetLanguage={course.targetLanguage}
      translateExample={(targetText) =>
        translateVocabularyDraftExample({ data: { courseId, targetText } })
      }
      updateEntry={async (draft) => {
        const updated = await updateVocabularyEntry({
          data: { courseId, entryId, ...draft },
        });
        await router.invalidate();
        return updated;
      }}
    />
  );
};

// What an entry's dialog offers: its details, correcting it, and deleting
// it. A deleted entry's list refreshes without being awaited, so the dialog
// closes and hands focus on while the entry's row is still there.
export const useCourseEntryActions = (
  course: EntryCourse,
  entries: ReadonlyArray<VocabularyEntry>,
): CourseEntryActions => {
  const router = useRouter();
  return {
    renderDetail: (entry) => (
      <CourseEntryDetail course={course} entry={entry} />
    ),
    renderEditor: (entry, control) => (
      <CourseEntryEditor
        control={control}
        course={course}
        entries={entries}
        entry={entry}
      />
    ),
    remove: async (entry) => {
      await deleteCourseEntry({
        data: { courseId: course.id, entryId: entry.id },
      });
      router.invalidate().catch(() => undefined);
    },
  };
};
