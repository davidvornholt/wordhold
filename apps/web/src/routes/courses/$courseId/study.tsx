import { createFileRoute, useRouterState } from '@tanstack/react-router';
import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import type { VocabularySearchData } from '../../../features/courses/schemas/vocabulary-search';
import { prepareVocabularyExamples } from '../../../features/courses/services/server-fns';
import { submitAnswer } from '../../../features/practice/services/server-fns';
import { sessionOptions } from '../../../features/practice/services/session-options';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { UnlearnedNotice } from '../../../features/practice/ui/unlearned-notice';
import {
  type CourseSubject,
  courseNouns,
  isListCourse,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { focusShell } from '../../../shared/routing/shell';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { FocusLayout } from '../../../shared/ui/focus-layout';
import { cardClass } from '../../../shared/ui/surface-styles';
import {
  type CoursePlace,
  PlaceBackLink,
  PlacePageLink,
} from './-course-place';
import { StudyLearning } from './-study-learning';
import { parseStudyRouteSearch, studySearch } from './-study-link';
import { loadStudyData } from './-study-loader';

type StudyCourse = CourseSubject & {
  readonly id: string;
  readonly name: string;
};

type StudyOrigin = {
  readonly course: StudyCourse;
  readonly place: CoursePlace | undefined;
  readonly list: VocabularySearchData;
  readonly fromFragile: boolean;
};

// A selection is made on a book's or unit's page, in a language's word list,
// or on a subject's or collection's own page, which is its list of entries.
// The way back leads to where it was made, with the list's filter and place
// as they were. The overview's Wackelkandidaten lead back to the overview.
const StudySelectionControl = ({
  course,
  place,
  list,
  fromFragile,
}: StudyOrigin) => {
  if (place !== undefined) {
    return (
      <PlacePageLink
        courseId={course.id}
        filter={list.filter}
        selection={place.selection}
        variant="quiet-muted"
      >
        Neue Auswahl treffen
      </PlacePageLink>
    );
  }
  if (fromFragile) {
    return (
      <ActionLink to="/" variant="quiet-muted">
        Zurück zur Übersicht
      </ActionLink>
    );
  }
  return isListCourse(course.kind) ? (
    <ActionLink
      params={{ courseId: course.id }}
      search={{ filter: list.filter }}
      to="/courses/$courseId"
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </ActionLink>
  ) : (
    <ActionLink
      params={{ courseId: course.id }}
      search={{ filter: list.filter ?? 'all', place: list.place }}
      to="/courses/$courseId/vocabulary"
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </ActionLink>
  );
};

const StudyBackControl = ({
  course,
  place,
  list,
  fromFragile,
}: StudyOrigin) => {
  if (place !== undefined) {
    return (
      <PlaceBackLink
        courseId={course.id}
        filter={list.filter}
        selection={place.selection}
      >
        {place.name}
      </PlaceBackLink>
    );
  }
  if (fromFragile) {
    return <BackLink to="/">Übersicht</BackLink>;
  }
  return isListCourse(course.kind) ? (
    <BackLink
      params={{ courseId: course.id }}
      search={{ filter: list.filter }}
      to="/courses/$courseId"
    >
      {course.name}
    </BackLink>
  ) : (
    <BackLink
      params={{ courseId: course.id }}
      search={{ filter: list.filter ?? 'all', place: list.place }}
      to="/courses/$courseId/vocabulary"
    >
      Vokabelliste
    </BackLink>
  );
};

// Learning the selection first, without losing where it came from.
const StudyLearnLink = ({ primary }: { readonly primary: boolean }) => (
  <ActionLink
    from="/courses/$courseId/study"
    search={studySearch('learn')}
    to="/courses/$courseId/study"
    variant={primary ? 'primary' : 'outline'}
  >
    Auswahl kennenlernen
  </ActionLink>
);

type StudyPracticeStartProps = {
  readonly course: StudyCourse;
  readonly availableDirections: ReadonlyArray<AnswerDirection>;
  readonly ready: ReadonlyArray<{ readonly direction: AnswerDirection }>;
  readonly unlearned: number;
};

const StudyPracticeStart = ({
  course,
  availableDirections,
  ready,
  unlearned,
}: StudyPracticeStartProps) => {
  const navigating = useRouterState({ select: (state) => state.isLoading });
  if (ready.length === 0) {
    return unlearned > 0 ? (
      <UnlearnedNotice
        learnAction={<StudyLearnLink primary={true} />}
        practisable={false}
        unlearned={unlearned}
      />
    ) : (
      <p className={`${cardClass} text-sm`}>
        Diese Auswahl enthält keine {courseNouns(course).plural}.
      </p>
    );
  }
  return (
    <>
      <p className="text-muted-foreground text-sm">
        Richtige Antworten vor ihrem Termin verschieben den Lernplan nicht. Eine
        falsche Antwort wird dagegen früher erneut eingeplant.
      </p>
      {unlearned > 0 ? (
        <UnlearnedNotice
          learnAction={<StudyLearnLink primary={false} />}
          practisable={true}
          unlearned={unlearned}
        />
      ) : null}
      <SessionStart
        itemNoun={{ singular: 'Karte', plural: 'Karten' }}
        options={sessionOptions(availableDirections, course, [
          ...answerDirections.map((candidate) => ({
            direction: candidate,
            ready: ready.filter((item) => item.direction === candidate).length,
          })),
          { direction: 'both', ready: ready.length },
        ])}
        preferenceKey={`${course.id}:study`}
        renderStartAction={(option, rememberDirection) => (
          <ActionLink
            aria-busy={navigating}
            className="w-fit"
            from="/courses/$courseId/study"
            onClick={rememberDirection}
            search={studySearch('practice', option.value)}
            to="/courses/$courseId/study"
          >
            {navigating
              ? 'Wird vorbereitet …'
              : `${countNoun(option.cards, 'Karte', 'Karten')} starten`}
          </ActionLink>
        )}
      />
    </>
  );
};

const StudyScreen = () => {
  const {
    availableDirections,
    course,
    direction,
    learningPass,
    mode,
    place,
    preview,
    selection,
    session,
    unlearned,
  } = Route.useLoaderData();
  const search = Route.useSearch();
  const fromFragile = search.from === 'fragile';
  const origin = {
    course,
    place,
    list: { filter: search.filter, place: search.place },
    fromFragile,
  };
  const nouns = courseNouns(course);
  // Entries picked by hand are a selection of their own, even when they
  // were picked on a book's or unit's page.
  let titleSubject = 'Auswahl';
  if (fromFragile) {
    titleSubject = 'Wackelkandidaten';
  } else if (
    place !== undefined &&
    selection !== null &&
    !('entryIds' in selection)
  ) {
    titleSubject = place.name;
  }
  const title = `${titleSubject} · ${mode === 'learn' ? 'Kennenlernen' : 'Üben'}`;
  let content: ReactNode;
  if (selection === null) {
    content = (
      <p className={`${cardClass} text-sm`}>
        {isListCourse(course.kind)
          ? `Wähle zuerst mindestens einen ${nouns.singular} aus.`
          : 'Wähle zuerst mindestens eine Vokabel, ein Buch oder eine Einheit aus.'}
      </p>
    );
  } else if (mode === 'learn') {
    content = (
      <StudyLearning
        courseId={course.id}
        direction={direction}
        pass={learningPass}
        subject={course}
      />
    );
  } else if (session === null) {
    content = (
      <StudyPracticeStart
        availableDirections={availableDirections}
        course={course}
        ready={preview.items}
        unlearned={unlearned}
      />
    );
  } else {
    content = (
      <SessionRunner
        backControl={<StudySelectionControl {...origin} />}
        emptyMessage={`Diese Auswahl enthält keine ${nouns.plural}.`}
        key={direction}
        mode="drill"
        prepareExamples={prepareVocabularyExamples}
        session={session}
        subject={course}
        submit={submitAnswer}
      />
    );
  }

  return (
    <FocusLayout exit={<StudyBackControl {...origin} />} title={title}>
      {content}
    </FocusLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/study')({
  staticData: focusShell,
  validateSearch: parseStudyRouteSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => loadStudyData(params.courseId, deps),
  component: StudyScreen,
});
