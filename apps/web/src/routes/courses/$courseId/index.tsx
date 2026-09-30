import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  type CourseOutline,
  courseTotals,
  recommendedAction,
  type VocabularyEntry,
} from '../../../features/courses/schemas/course-units';
import { parseSubjectSearch } from '../../../features/courses/schemas/vocabulary-search';
import {
  createCourseBook,
  getCourseDirections,
  getCourseOutline,
  listCourseVocabulary,
} from '../../../features/courses/services/server-fns';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { placeLinkClass } from '../../../features/courses/ui/place-link-styles';
import { QuickEntry } from '../../../features/courses/ui/quick-entry';
import { SubjectOverview } from '../../../features/courses/ui/subject-overview';
import type { CourseStats } from '../../../features/dashboard/schemas/dashboard-models';
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
import {
  CourseEntryDetail,
  type EntryCourse,
  TermEntryForm,
  VocabularyEntryForm,
} from './-entry-forms';

type ScreenCourse = EntryCourse & { readonly name: string };

const PracticeLink = ({
  courseId,
  ready,
}: {
  readonly courseId: string;
  readonly ready: number;
}) => (
  <ActionLink params={{ courseId }} to="/courses/$courseId/practice">
    {countNoun(ready, 'Karte', 'Karten')} üben
  </ActionLink>
);

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
    return <PracticeLink courseId={courseId} ready={ready} />;
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

const SettingsLink = ({ courseId }: { readonly courseId: string }) => (
  <ActionLink
    params={{ courseId }}
    to="/courses/$courseId/settings"
    variant="quiet"
  >
    Einstellungen
  </ActionLink>
);

type LanguageScreenProps = {
  readonly course: ScreenCourse;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly outline: CourseOutline;
  readonly stats: CourseStats | undefined;
};

const LanguageScreen = ({
  course,
  entries,
  outline,
  stats,
}: LanguageScreenProps) => {
  const router = useRouter();
  const isEmpty = courseTotals(outline).entries === 0;
  return (
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
          <QuickEntry
            outline={outline}
            renderForm={(place) => (
              <VocabularyEntryForm
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
      settingsAction={<SettingsLink courseId={course.id} />}
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
  );
};

// Practice comes first while cards are ready, then the terms not yet
// learned. A subject has one direction, so learning names no direction.
const subjectPrimaryAction = (
  courseId: string,
  entries: ReadonlyArray<VocabularyEntry>,
  ready: number,
): ReactNode => {
  const unintroduced = entries.filter((entry) => !entry.introduced).length;
  if (ready > 0) {
    return <PracticeLink courseId={courseId} ready={ready} />;
  }
  if (unintroduced === 0) {
    return null;
  }
  return (
    <PlaceLearnLink courseId={courseId} direction={undefined} selection={null}>
      {countNoun(itemsInNextSection(unintroduced), 'Begriff', 'Begriffe')}{' '}
      kennenlernen
    </PlaceLearnLink>
  );
};

type SubjectScreenProps = {
  readonly course: ScreenCourse;
  readonly directions: LoaderDirections;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly stats: CourseStats | undefined;
};

const SubjectScreen = ({
  course,
  directions,
  entries,
  stats,
}: SubjectScreenProps) => {
  const { filter } = Route.useSearch();
  return (
    <SubjectOverview
      enabledDirections={directions}
      entries={entries}
      entryForm={<TermEntryForm course={course} entries={entries} />}
      initialFilter={filter ?? 'all'}
      primaryAction={subjectPrimaryAction(
        course.id,
        entries,
        stats?.ready ?? 0,
      )}
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
      settingsAction={<SettingsLink courseId={course.id} />}
      subject={course}
    />
  );
};

// A language is organised into books and units; a subject is one list of
// terms.
const CourseScreen = () => {
  const { course, directions, entries, outline, stats } = Route.useLoaderData();
  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title={course.name}
    >
      {course.kind === 'terms' ? (
        <SubjectScreen
          course={course}
          directions={directions}
          entries={entries}
          stats={stats}
        />
      ) : (
        <LanguageScreen
          course={course}
          entries={entries}
          outline={outline}
          stats={stats}
        />
      )}
    </PageLayout>
  );
};

type LoaderDirections = Awaited<ReturnType<typeof getCourseDirections>>;

export const Route = createFileRoute('/courses/$courseId/')({
  validateSearch: parseSubjectSearch,
  loader: async ({ params }) => {
    const [course, outline, directions, entries, dashboard] = await Promise.all(
      [
        getCourse({ data: params.courseId }),
        getCourseOutline({ data: params.courseId }),
        getCourseDirections({ data: params.courseId }),
        listCourseVocabulary({ data: params.courseId }),
        getDashboard(),
      ],
    );
    return {
      course,
      directions,
      entries,
      outline,
      stats: dashboard.perCourse.find((stats) => stats.courseId === course.id),
    };
  },
  component: CourseScreen,
});
