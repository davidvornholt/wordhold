import { createFileRoute, Link } from '@tanstack/react-router';
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
  resolveSessionDirection,
  sessionOptions,
} from '../../../features/practice/services/session-options';
import { PracticeLayout } from '../../../features/practice/ui/practice-layout';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { germanLabels } from '../../../shared/languages';

const StudyScreen = () => {
  const { course, direction, preview, selection, session, unit } =
    Route.useLoaderData();
  const targetLabel = germanLabels[course.targetLanguage];
  const backControl =
    unit === undefined ? (
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        params={{ courseId: course.id }}
        search={{ filter: 'all' }}
        to="/courses/$courseId/vocabulary"
      >
        ← Vokabelliste
      </Link>
    ) : (
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        params={{ courseId: course.id, unitId: unit.id }}
        to="/courses/$courseId/units/$unitId"
      >
        ← {unit.name}
      </Link>
    );
  const title = unit === undefined ? 'Auswahl frei üben' : `${unit.name} üben`;
  let content: ReactNode;
  if (selection === null) {
    content = (
      <p className="border border-border bg-card p-6 text-sm">
        Wähle zuerst mindestens eine Vokabel oder eine Unit aus.
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
          options={sessionOptions(answerDirections, targetLabel, [
            ...answerDirections.map((candidate) => ({
              direction: candidate,
              ready: preview.items.filter(
                (item) => item.direction === candidate,
              ).length,
            })),
            { direction: 'both', ready: preview.items.length },
          ])}
          preferenceKey={course.id}
          renderStartAction={(option, rememberDirection) => (
            <Link
              className="inline-flex min-h-11 w-fit items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={rememberDirection}
              params={{ courseId: course.id }}
              search={{
                direction: option.value,
                entries: entriesSearch,
                unit: unitSearch,
              }}
              to="/courses/$courseId/study"
            >
              {option.cards} {option.cards === 1 ? 'Karte' : 'Karten'} starten
            </Link>
          )}
        />
      </>
    );
  } else {
    content = (
      <SessionRunner
        backControl={backControl}
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
    <PracticeLayout backControl={backControl} title={title}>
      {content}
    </PracticeLayout>
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
        direction: undefined,
        preview: { items: [] },
        selection,
        session: null,
        unit,
      };
    }
    const direction = resolveSessionDirection(deps.direction, answerDirections);
    const preview = await getStudySession({
      data: { courseId: course.id, direction: 'both', selection },
    });
    let session: PracticeSession | null = null;
    if (direction === 'both') {
      session = preview;
    } else if (direction !== undefined) {
      session = await getStudySession({
        data: { courseId: course.id, direction, selection },
      });
    }
    return { course, direction, preview, selection, session, unit };
  },
  component: StudyScreen,
});
