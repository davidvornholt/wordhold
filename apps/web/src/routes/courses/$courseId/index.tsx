import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  type CourseOutline,
  courseTotals,
  recommendedAction,
} from '../../../features/courses/schemas/course-units';
import {
  createCourseBook,
  getCourseOutline,
  listCourseVocabulary,
} from '../../../features/courses/services/server-fns';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { placeLinkClass } from '../../../features/courses/ui/place-link-styles';
import { QuickEntry } from '../../../features/courses/ui/quick-entry';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import {
  type CourseSubject,
  courseNouns,
  directionLabel,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { languageSubtitle } from '../../../shared/languages';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';
import { coursePlaces, PlaceLearnLink } from './-course-place';
import { CourseEntryForm } from './-entry-forms';

// Practice comes first while cards are ready, then the next entries to learn
// in course order: each book's own entries before its units. A language
// without vocabulary starts with a photographed page; an empty subject has
// no action beyond typing its first term.
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
  if (isEmpty && subject.kind === 'language') {
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
  const isEmpty = courseTotals(outline).entries === 0;
  const isSubject = course.kind === 'terms';

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
          isEmpty || isSubject ? null : (
            <ActionLink
              params={{ courseId: course.id }}
              to="/courses/$courseId/import"
              variant="quiet"
            >
              Seite fotografieren
            </ActionLink>
          )
        }
        languageLabel={
          isSubject
            ? null
            : languageSubtitle(course.name, course.targetLanguage)
        }
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
            <QuickEntry
              outline={outline}
              renderForm={(place) => (
                <CourseEntryForm
                  course={course}
                  entries={entries}
                  place={place}
                />
              )}
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
            {courseNouns(course).list}
          </ActionLink>
        }
        subject={course}
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
