import { createFileRoute, redirect } from '@tanstack/react-router';
import { useRef } from 'react';
import { parseVocabularySearch } from '../../../features/courses/schemas/vocabulary-search';
import {
  getCourseDirections,
  listCourseVocabulary,
} from '../../../features/courses/services/server-fns';
import { VocabularyLibrary } from '../../../features/courses/ui/vocabulary-library';
import { getCourse } from '../../../features/import/server-fns';
import { isListCourse } from '../../../shared/directions';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';
import { useCourseEntryActions } from './-entry-forms';
import { SelectionActions } from './-selection-actions';

const VocabularyScreen = () => {
  const { course, directions, entries, filter, place } = Route.useLoaderData();
  const entryActions = useCourseEntryActions(course, entries);
  // Takes focus once a word is deleted, since its row is gone.
  const introRef = useRef<HTMLParagraphElement>(null);
  return (
    <PageLayout
      backControl={
        <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
          {course.name}
        </BackLink>
      }
      title="Vokabelliste"
    >
      <p
        className="text-muted-foreground text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        ref={introRef}
        tabIndex={-1}
      >
        Termine gelten pro Abfragerichtung. Wähle beliebige Vokabeln aus und übe
        genau diese Auswahl.
      </p>
      <VocabularyLibrary
        enabledDirections={directions}
        entries={entries}
        entryActions={entryActions}
        fallbackFocusRef={introRef}
        initialFilter={filter}
        initialPlaceId={place}
        renderStudyAction={(entryIds, intent) => (
          <SelectionActions
            courseId={course.id}
            intent={intent}
            search={{ entries: entryIds.join(',') }}
            sentences={true}
          />
        )}
        layout="by-place"
        subject={course}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/vocabulary')({
  validateSearch: parseVocabularySearch,
  loaderDeps: ({ search }) => ({
    filter: search.filter ?? 'all',
    place: search.place,
  }),
  loader: async ({ params, deps }) => {
    const [course, directions, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    // A subject's or collection's page is its list of entries.
    if (isListCourse(course.kind)) {
      throw redirect({
        to: '/courses/$courseId',
        params: { courseId: course.id },
        search: { filter: deps.filter },
      });
    }
    return {
      course,
      directions,
      entries,
      filter: deps.filter,
      place: deps.place,
    };
  },
  component: VocabularyScreen,
});
