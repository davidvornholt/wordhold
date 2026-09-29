import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  type CourseOutline,
  courseTotals,
  recommendedAction,
} from '../../../features/courses/schemas/course-units';
import {
  createCourseBook,
  createVocabularyEntry,
  generateVocabularyDraftExample,
  getCourseOutline,
  listCourseVocabulary,
  suggestVocabularyTranslation,
  translateVocabularyDraftExample,
} from '../../../features/courses/services/server-fns';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { placeLinkClass } from '../../../features/courses/ui/place-link-styles';
import { QuickVocabularyEntry } from '../../../features/courses/ui/quick-vocabulary-entry';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import {
  type CourseSubject,
  courseNouns,
  directionLabel,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { germanLabels, languageSubtitle } from '../../../shared/languages';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';
import { coursePlaces, PlaceLearnLink } from './-course-place';

// Practice comes first while cards are ready, then the next words to learn
// in course order: each book's own words before its units. A course without
// vocabulary starts with a photographed page.
const coursePrimaryAction = ({
  courseId,
  isEmpty,
  outline,
  ready,
  subject,
}: {
  readonly courseId: string;
  readonly isEmpty: boolean;
  readonly outline: CourseOutline;
  readonly ready: number;
  readonly subject: CourseSubject;
}): ReactNode => {
  const nouns = courseNouns(subject);
  const nextPlace = coursePlaces(outline).find(
    (place) => place.unintroduced > 0,
  );
  if (ready > 0) {
    return (
      <ActionLink params={{ courseId }} to="/courses/$courseId/practice">
        {countNoun(ready, 'Karte', 'Karten')} üben
      </ActionLink>
    );
  }
  if (nextPlace !== undefined) {
    const recommendation = recommendedAction(nextPlace);
    const recommendedDirection =
      recommendation?.kind === 'learn'
        ? nextPlace.directions.find(
            (progress) => progress.direction === recommendation.direction,
          )
        : undefined;
    return (
      <PlaceLearnLink
        courseId={courseId}
        direction={recommendedDirection?.direction}
        selection={nextPlace.selection}
      >
        {recommendedDirection === undefined
          ? `Neue ${nouns.plural} kennenlernen`
          : `${countNoun(
              itemsInNextSection(recommendedDirection.unintroduced),
              nouns.singular,
              nouns.plural,
            )} kennenlernen · ${directionLabel(
              recommendedDirection.direction,
              subject,
            )}`}
      </PlaceLearnLink>
    );
  }
  if (isEmpty) {
    return (
      <ActionLink params={{ courseId }} to="/courses/$courseId/import">
        Seite fotografieren
      </ActionLink>
    );
  }
  return null;
};

const CourseScreen = () => {
  const { course, entries, outline, stats } = Route.useLoaderData();
  const router = useRouter();
  // A typed word refreshes the loader so the page's counts include it.
  const refreshed = async <A,>(update: Promise<A>): Promise<A> => {
    const next = await update;
    await router.invalidate();
    return next;
  };
  const isEmpty = courseTotals(outline).entries === 0;

  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title={course.name}
    >
      <CourseOverview
        createBook={async (name) => {
          const { bookId } = await createCourseBook({
            data: { courseId: course.id, name },
          });
          await router.navigate({
            params: { courseId: course.id, bookId },
            to: '/courses/$courseId/books/$bookId',
          });
        }}
        importAction={
          isEmpty ? null : (
            <ActionLink
              params={{ courseId: course.id }}
              to="/courses/$courseId/import"
              variant="quiet"
            >
              Seite fotografieren
            </ActionLink>
          )
        }
        languageLabel={languageSubtitle(course.name, course.targetLanguage)}
        outline={outline}
        primaryAction={coursePrimaryAction({
          courseId: course.id,
          isEmpty,
          outline,
          ready: stats?.ready ?? 0,
          subject: course,
        })}
        quickEntry={
          outline.books.length === 0 ? null : (
            <QuickVocabularyEntry
              createEntry={(place, draft) =>
                refreshed(
                  createVocabularyEntry({
                    data: { courseId: course.id, ...place, ...draft },
                  }),
                )
              }
              entries={entries}
              generateExample={(targetText, nativeText) =>
                generateVocabularyDraftExample({
                  data: { courseId: course.id, targetText, nativeText },
                })
              }
              outline={outline}
              suggestTranslation={(place, text, given) =>
                suggestVocabularyTranslation({
                  data: { courseId: course.id, ...place, text, given },
                })
              }
              targetLabel={germanLabels[course.targetLanguage]}
              targetLanguage={course.targetLanguage}
              translateExample={(targetText) =>
                translateVocabularyDraftExample({
                  data: { courseId: course.id, targetText },
                })
              }
            />
          )
        }
        renderBookLink={(book) => (
          <Link
            className={placeLinkClass}
            params={{ courseId: course.id, bookId: book.id }}
            to="/courses/$courseId/books/$bookId"
          >
            {book.name}
          </Link>
        )}
        settingsAction={
          <ActionLink
            params={{ courseId: course.id }}
            to="/courses/$courseId/settings"
            variant="quiet"
          >
            Einstellungen
          </ActionLink>
        }
        vocabularyAction={
          <ActionLink
            params={{ courseId: course.id }}
            search={{ filter: 'all' }}
            to="/courses/$courseId/vocabulary"
            variant="quiet"
          >
            Vokabelliste
          </ActionLink>
        }
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/')({
  loader: async ({ params }) => {
    const [course, outline, entries, dashboard] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseOutline({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
      getDashboard(),
    ]);
    return {
      course,
      entries,
      outline,
      stats: dashboard.perCourse.find((stats) => stats.courseId === course.id),
    };
  },
  component: CourseScreen,
});
