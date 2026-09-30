import { useRouter } from '@tanstack/react-router';
import type { VocabularyEntry } from '../../../features/courses/schemas/course-units';
import {
  createVocabularyEntry,
  generateVocabularyDraftExample,
  generateVocabularyExample,
  suggestVocabularyTranslation,
  translateVocabularyDraftExample,
} from '../../../features/courses/services/server-fns';
import {
  createTermEntry,
  deriveTermKeyPoints,
  suggestTermDefinition,
  updateTermKeyPoints,
} from '../../../features/courses/services/term-server-fns';
import { NewTermForm } from '../../../features/courses/ui/new-term-form';
import { NewVocabularyForm } from '../../../features/courses/ui/new-vocabulary-form';
import { TermKeyPoints } from '../../../features/courses/ui/term-key-points';
import { VocabularyExample } from '../../../features/courses/ui/vocabulary-example';
import type { WordPlace } from '../../../features/courses/ui/word-places';
import type { CourseSubject } from '../../../shared/directions';
import { germanLabels } from '../../../shared/languages';

export type EntryCourse = CourseSubject & { readonly id: string };

type TermEntryFormProps = {
  readonly course: EntryCourse;
  // Every term of the subject, which a typed term is checked against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
};

// Typing a term with its definition into a subject. Each saved term refreshes
// the loader so the page's counts and list include it. Its key points are
// derived after it is saved, without holding up the next term; practice
// derives them itself if that has not finished.
export const TermEntryForm = ({ course, entries }: TermEntryFormProps) => {
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

// What an entry's schedule shows besides its dates: a word's example
// sentence, generated on request, or a term's key points.
export const CourseEntryDetail = ({ course, entry }: CourseEntryDetailProps) =>
  course.kind === 'terms' ? (
    <TermKeyPoints
      derive={() =>
        deriveTermKeyPoints({
          data: { courseId: course.id, entryId: entry.id },
        })
      }
      keyPoints={entry.keyPoints}
      update={(keyPoints) =>
        updateTermKeyPoints({
          data: { courseId: course.id, entryId: entry.id, keyPoints },
        })
      }
    />
  ) : (
    <VocabularyExample
      entry={entry}
      generate={() => generateVocabularyExample({ data: entry.id })}
      targetLanguage={course.targetLanguage}
    />
  );
