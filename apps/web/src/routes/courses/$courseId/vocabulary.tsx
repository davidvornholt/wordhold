import { createFileRoute } from '@tanstack/react-router';
import { parseVocabularySearch } from '../../../features/courses/schemas/vocabulary-search';
import {
  getCourseDirections,
  listCourseVocabulary,
} from '../../../features/courses/services/server-fns';
import { VocabularyLibrary } from '../../../features/courses/ui/vocabulary-library';
import { getCourse } from '../../../features/import/server-fns';
import { courseNouns } from '../../../shared/directions';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';
import { CourseEntryDetail } from './-entry-forms';

const VocabularyScreen = () => {
  const { course, directions, entries, filter, place } = Route.useLoaderData();
  const nouns = courseNouns(course);
  return (
    <PageLayout
      backControl={
        <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
          {course.name}
        </BackLink>
      }
      title={nouns.list}
    >
      <p className="text-muted-foreground text-sm">
        {course.kind === 'terms'
          ? 'Wähle beliebige Begriffe aus und übe genau diese Auswahl.'
          : 'Termine gelten pro Abfragerichtung. Wähle beliebige Vokabeln aus und übe genau diese Auswahl.'}
      </p>
      <VocabularyLibrary
        enabledDirections={directions}
        entries={entries}
        initialFilter={filter}
        initialPlaceId={place}
        renderEntryDetail={(entry) => (
          <CourseEntryDetail course={course} entry={entry} />
        )}
        renderStudyAction={(entryIds, intent) => (
          <ActionLink
            params={{ courseId: course.id }}
            search={{ entries: entryIds.join(','), mode: intent }}
            to="/courses/$courseId/study"
          >
            Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
          </ActionLink>
        )}
        scope="course"
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
