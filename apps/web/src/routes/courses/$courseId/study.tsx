import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { answerDirections } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import { prepareVocabularyExamples } from '../../../features/courses/services/server-fns';
import { parseStudySearch } from '../../../features/practice/schemas/session-request';
import { submitAnswer } from '../../../features/practice/services/server-fns';
import { sessionOptions } from '../../../features/practice/services/session-options';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { courseNouns } from '../../../shared/directions';
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
import { StudyLearning, selectionSearch } from './-study-learning';
import { loadStudyData } from './-study-loader';

const StudySelectionControl = ({
  courseId,
  place,
}: {
  readonly courseId: string;
  readonly place: CoursePlace | undefined;
}) =>
  place === undefined ? (
    <ActionLink
      params={{ courseId }}
      search={{ filter: 'all' }}
      to="/courses/$courseId/vocabulary"
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </ActionLink>
  ) : (
    <PlacePageLink
      courseId={courseId}
      selection={place.selection}
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </PlacePageLink>
  );

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
  } = Route.useLoaderData();
  const nouns = courseNouns(course);
  const navigating = useRouterState({ select: (state) => state.isLoading });
  const backControl =
    place === undefined ? (
      <BackLink
        params={{ courseId: course.id }}
        search={{ filter: 'all' }}
        to="/courses/$courseId/vocabulary"
      >
        {nouns.list}
      </BackLink>
    ) : (
      <PlaceBackLink courseId={course.id} selection={place.selection}>
        {place.name}
      </PlaceBackLink>
    );
  const titleSubject = place === undefined ? 'Auswahl' : place.name;
  const title = `${titleSubject} · ${mode === 'learn' ? 'Kennenlernen' : 'Üben'}`;
  let content: ReactNode;
  if (selection === null) {
    content = (
      <p className={`${cardClass} text-sm`}>
        Wähle zuerst {nouns.plural}, ein Buch oder eine Einheit aus.
      </p>
    );
  } else if (mode === 'learn') {
    content = (
      <StudyLearning
        courseId={course.id}
        direction={direction}
        pass={learningPass}
        selection={selection}
        subject={course}
      />
    );
  } else if (session === null) {
    content = (
      <>
        <p className="text-muted-foreground text-sm">
          Richtige Antworten vor ihrem Termin verschieben den Lernplan nicht.
          Eine falsche Antwort wird dagegen früher erneut eingeplant.
        </p>
        <SessionStart
          itemNoun={{ singular: 'Karte', plural: 'Karten' }}
          options={sessionOptions(availableDirections, course, [
            ...answerDirections.map((candidate) => ({
              direction: candidate,
              ready: preview.items.filter(
                (item) => item.direction === candidate,
              ).length,
            })),
            { direction: 'both', ready: preview.items.length },
          ])}
          preferenceKey={`${course.id}:study`}
          renderStartAction={(option, rememberDirection) => (
            <ActionLink
              aria-busy={navigating}
              className="w-fit"
              onClick={rememberDirection}
              params={{ courseId: course.id }}
              search={selectionSearch(selection, 'practice', option.value)}
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
  } else {
    content = (
      <SessionRunner
        backControl={
          <StudySelectionControl courseId={course.id} place={place} />
        }
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
    <FocusLayout exit={backControl} title={title}>
      {content}
    </FocusLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/study')({
  staticData: focusShell,
  validateSearch: parseStudySearch,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => loadStudyData(params.courseId, deps),
  component: StudyScreen,
});
