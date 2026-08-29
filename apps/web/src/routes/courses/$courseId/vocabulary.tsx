import { createFileRoute, Link } from '@tanstack/react-router';
import { parseVocabularySearch } from '../../../features/courses/schemas/vocabulary-search';
import {
  getCourseDirections,
  listCourseVocabulary,
} from '../../../features/courses/services/server-fns';
import { CourseLayout } from '../../../features/courses/ui/course-layout';
import { VocabularyLibrary } from '../../../features/courses/ui/vocabulary-library';
import { getCourse } from '../../../features/import/server-fns';

const VocabularyScreen = () => {
  const { course, directions, entries, filter, unit } = Route.useLoaderData();
  return (
    <CourseLayout
      backControl={
        <Link
          className="text-muted-foreground text-sm underline underline-offset-4"
          params={{ courseId: course.id }}
          to="/courses/$courseId"
        >
          ← {course.name}
        </Link>
      }
      title={`${course.name}: Vokabelliste`}
    >
      <p className="text-muted-foreground text-sm">
        Termine gelten pro Abfragerichtung. Wähle beliebige kennengelernte
        Vokabeln aus, um sie außerhalb des Lernplans zu üben.
      </p>
      <VocabularyLibrary
        enabledDirections={directions}
        entries={entries}
        initialFilter={filter}
        initialUnitId={unit}
        renderStudyAction={(entryIds) => (
          <Link
            className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            params={{ courseId: course.id }}
            search={{ entries: entryIds.join(',') }}
            to="/courses/$courseId/study"
          >
            Frei üben
          </Link>
        )}
        targetLanguage={course.targetLanguage}
      />
    </CourseLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/vocabulary')({
  validateSearch: parseVocabularySearch,
  loaderDeps: ({ search }) => ({
    filter: search.filter ?? 'all',
    unit: search.unit,
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
      unit: deps.unit,
    };
  },
  component: VocabularyScreen,
});
