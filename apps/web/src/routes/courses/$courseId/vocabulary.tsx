import { createFileRoute, Link } from '@tanstack/react-router';
import { parseVocabularySearch } from '../../../features/courses/schemas/vocabulary-search';
import { listCourseVocabulary } from '../../../features/courses/services/server-fns';
import { CourseLayout } from '../../../features/courses/ui/course-layout';
import { VocabularyLibrary } from '../../../features/courses/ui/vocabulary-library';
import { getCourse } from '../../../features/import/server-fns';

const VocabularyScreen = () => {
  const { course, entries, filter } = Route.useLoaderData();
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
        entries={entries}
        initialFilter={filter}
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
  loaderDeps: ({ search }) => ({ filter: search.filter ?? 'all' }),
  loader: async ({ params, deps }) => {
    const [course, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    return { course, entries, filter: deps.filter };
  },
  component: VocabularyScreen,
});
