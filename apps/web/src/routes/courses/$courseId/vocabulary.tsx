import { createFileRoute } from '@tanstack/react-router';
import { parseVocabularySearch } from '../../../features/courses/schemas/vocabulary-search';
import {
  generateVocabularyExample,
  getCourseDirections,
  listCourseVocabulary,
} from '../../../features/courses/services/server-fns';
import { VocabularyLibrary } from '../../../features/courses/ui/vocabulary-library';
import { getCourse } from '../../../features/import/server-fns';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';

const VocabularyScreen = () => {
  const { course, directions, entries, filter, unit } = Route.useLoaderData();
  return (
    <PageLayout
      backControl={
        <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
          {course.name}
        </BackLink>
      }
      title="Vokabelliste"
    >
      <p className="text-muted-foreground text-sm">
        Termine gelten pro Abfragerichtung. Wähle beliebige Vokabeln aus und übe
        genau diese Auswahl.
      </p>
      <VocabularyLibrary
        enabledDirections={directions}
        entries={entries}
        generateExample={(entryId) =>
          generateVocabularyExample({ data: entryId })
        }
        initialFilter={filter}
        initialUnitId={unit}
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
        targetLanguage={course.targetLanguage}
      />
    </PageLayout>
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
