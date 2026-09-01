import { createFileRoute } from '@tanstack/react-router';
import { answerDirections } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import { prepareVocabularyExamples } from '../../../features/courses/services/server-fns';
import { parseStudySearch } from '../../../features/practice/schemas/session-request';
import { submitAnswer } from '../../../features/practice/services/server-fns';
import { sessionOptions } from '../../../features/practice/services/session-options';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { countNoun } from '../../../shared/format/count';
import { germanLabels } from '../../../shared/languages';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';
import { cardClass } from '../../../shared/ui/surface-styles';
import { StudyLearning } from './-study-learning';
import { loadStudyData } from './-study-loader';

const StudySelectionControl = ({
  courseId,
  unit,
}: {
  readonly courseId: string;
  readonly unit: { readonly id: string } | undefined;
}) =>
  unit === undefined ? (
    <ActionLink
      params={{ courseId }}
      search={{ filter: 'all' }}
      to="/courses/$courseId/vocabulary"
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </ActionLink>
  ) : (
    <ActionLink
      params={{ courseId, unitId: unit.id }}
      to="/courses/$courseId/units/$unitId"
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </ActionLink>
  );

const StudyScreen = () => {
  const {
    availableDirections,
    course,
    direction,
    learningPass,
    mode,
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
  const titleSubject = unit === undefined ? 'Auswahl' : unit.name;
  const title = `${titleSubject} ${mode === 'learn' ? 'kennenlernen' : 'üben'}`;
  let content: ReactNode;
  if (selection === null) {
    content = (
      <p className={`${cardClass} text-sm`}>
        Wähle zuerst mindestens eine Vokabel oder eine Einheit aus.
      </p>
    );
  } else if (mode === 'learn') {
    content = (
      <StudyLearning
        courseId={course.id}
        direction={direction}
        pass={learningPass}
        selection={selection}
        targetLabel={targetLabel}
        targetLanguage={course.targetLanguage}
      />
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
          itemNoun={{ singular: 'Karte', plural: 'Karten' }}
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
                mode: 'practice',
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
        backControl={<StudySelectionControl courseId={course.id} unit={unit} />}
        emptyMessage="Diese Auswahl enthält keine Vokabeln."
        key={direction}
        mode="drill"
        prepareExamples={prepareVocabularyExamples}
        session={session}
        submit={submitAnswer}
        targetLabel={targetLabel}
        targetLanguage={course.targetLanguage}
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
  loader: ({ params, deps }) => loadStudyData(params.courseId, deps),
  component: StudyScreen,
});
