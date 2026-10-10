import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { parseRelationSearch } from '../../../features/courses/schemas/word-relations';
import {
  getCourseOutline,
  listCourseVocabulary,
} from '../../../features/courses/services/server-fns';
import {
  saveWordRelations,
  suggestWordRelations,
} from '../../../features/courses/services/word-relation-server-fns';
import { WordRelationReview } from '../../../features/courses/ui/word-relation-review';
import { getCourse } from '../../../features/import/server-fns';
import { isListCourse } from '../../../shared/directions';
import { PageLayout } from '../../../shared/ui/page-layout';
import { findCoursePlace, PlaceBackLink } from './-course-place';

const RelationScreen = () => {
  const { course, place, words } = Route.useLoaderData();
  const router = useRouter();
  return (
    <PageLayout
      backControl={
        <PlaceBackLink courseId={course.id} selection={place.selection}>
          {place.name}
        </PlaceBackLink>
      }
      title={`${place.name} · Synonyme und Gegenteile`}
    >
      <WordRelationReview
        onSaved={() => router.invalidate()}
        save={(changes) =>
          saveWordRelations({ data: { courseId: course.id, words: changes } })
        }
        suggest={(entryIds) =>
          suggestWordRelations({ data: { courseId: course.id, entryIds } })
        }
        targetLanguage={course.targetLanguage}
        words={words}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/relations')({
  validateSearch: parseRelationSearch,
  loaderDeps: ({ search }) => ({ book: search.book, unit: search.unit }),
  loader: async ({ params, deps }) => {
    const [course, outline, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseOutline({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    const place = findCoursePlace(outline, deps);
    // Synonyms and antonyms belong to a language course's words, reviewed
    // one book or unit at a time.
    if (isListCourse(course.kind) || place === undefined) {
      throw redirect({
        to: '/courses/$courseId',
        params: { courseId: course.id },
        search: {},
      });
    }
    const { selection } = place;
    return {
      course,
      place,
      words: entries.filter((entry) =>
        'bookId' in selection
          ? entry.bookId === selection.bookId && entry.unitId === null
          : entry.unitId === selection.unitId,
      ),
    };
  },
  component: RelationScreen,
});
