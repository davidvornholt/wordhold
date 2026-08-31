import { createFileRoute } from '@tanstack/react-router';
import { answerDirections } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import { listCourseUnits } from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import type { PracticeSession } from '../../../features/practice/schemas/practice-models';
import {
  parseStudySearch,
  type StudyRequestData,
  selectedEntryIds,
} from '../../../features/practice/schemas/session-request';
import {
  getStudySession,
  submitAnswer,
} from '../../../features/practice/services/server-fns';
import {
  directionsWithCards,
  resolveSessionDirection,
  sessionOptions,
} from '../../../features/practice/services/session-options';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { countNoun } from '../../../shared/format/count';
import { germanLabels } from '../../../shared/languages';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';
import { cardClass } from '../../../shared/ui/surface-styles';

const StudyScreen = () => {
  const {
    availableDirections,
    course,
    direction,
    preview,
    selection,
    session,
    unit,
  } = Route.useLoaderData();
  const targetLabel = germanLabels[course.targetLanguage];
  const backControl =
    unit === undefined ? (
      <BackLink
        params={{ courseId: course.id }}
        search={{ filter: 'all' }}
        to="/courses/$courseId/vocabulary"
      >
        Vokabelliste
      </BackLink>
    ) : (
      <BackLink
        params={{ courseId: course.id, unitId: unit.id }}
        to="/courses/$courseId/units/$unitId"
      >
        {unit.name}
      </BackLink>
    );
  // In-session and summary control: back to where the selection was made.
  const selectionControl =
    unit === undefined ? (
      <ActionLink
        params={{ courseId: course.id }}
        search={{ filter: 'all' }}
        to="/courses/$courseId/vocabulary"
        variant="quiet-muted"
      >
        Neue Auswahl treffen
      </ActionLink>
    ) : (
      <ActionLink
        params={{ courseId: course.id, unitId: unit.id }}
        to="/courses/$courseId/units/$unitId"
        variant="quiet-muted"
      >
        Neue Auswahl treffen
      </ActionLink>
    );
  const title = unit === undefined ? 'Auswahl frei üben' : `${unit.name} üben`;
  let content: ReactNode;
  if (selection === null) {
    content = (
      <p className={`${cardClass} text-sm`}>
        Wähle zuerst mindestens eine Vokabel oder eine Einheit aus.
      </p>
    );
  } else if (session === null) {
    const entriesSearch =
      'entryIds' in selection ? selection.entryIds.join(',') : undefined;
    const unitSearch = 'unitId' in selection ? selection.unitId : undefined;
    content = (
      <>
        <p className="text-muted-foreground text-sm">
          Richtige Antworten vor ihrem Termin verschieben den Lernplan nicht.
          Eine falsche Antwort wird dagegen früher erneut eingeplant.
        </p>
        <SessionStart
          options={sessionOptions(availableDirections, targetLabel, [
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
              className="w-fit"
              onClick={rememberDirection}
              params={{ courseId: course.id }}
              search={{
                direction: option.value,
                entries: entriesSearch,
                unit: unitSearch,
              }}
              to="/courses/$courseId/study"
            >
              {countNoun(option.cards, 'Karte', 'Karten')} starten
            </ActionLink>
          )}
        />
      </>
    );
  } else {
    content = (
      <SessionRunner
        backControl={selectionControl}
        emptyMessage="Diese Auswahl enthält noch keine kennengelernte Vokabel."
        key={direction}
        mode="drill"
        session={session}
        submit={submitAnswer}
        targetLabel={targetLabel}
      />
    );
  }

  return (
    <PageLayout backControl={backControl} title={title}>
      {content}
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/study')({
  validateSearch: parseStudySearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const [course, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
    ]);
    const unit = units.find((candidate) => candidate.id === deps.unit);
    const entryIds = selectedEntryIds(deps.entries);
    let selection: StudyRequestData['selection'] | null = null;
    if (unit !== undefined) {
      selection = { unitId: unit.id } as const;
    } else if (entryIds.length > 0) {
      selection = {
        entryIds: [entryIds[0] as string, ...entryIds.slice(1)],
      } as const;
    }
    if (selection === null) {
      return {
        course,
        availableDirections: [],
        direction: undefined,
        preview: { items: [] },
        selection,
        session: null,
        unit,
      };
    }
    const preview = await getStudySession({
      data: { courseId: course.id, direction: 'both', selection },
    });
    const availableDirections = directionsWithCards(preview.items);
    const direction = resolveSessionDirection(
      deps.direction,
      availableDirections,
    );
    let session: PracticeSession | null = null;
    if (direction === 'both') {
      session = preview;
    } else if (direction !== undefined) {
      session = await getStudySession({
        data: { courseId: course.id, direction, selection },
      });
    }
    return {
      availableDirections,
      course,
      direction,
      preview,
      selection,
      session,
      unit,
    };
  },
  component: StudyScreen,
});
