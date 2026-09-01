import { createFileRoute, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { prepareVocabularyExamples } from '../../../../../features/courses/services/server-fns';
import { getCourse } from '../../../../../features/import/server-fns';
import {
  getLearnPass,
  introduceCard,
} from '../../../../../features/learning/services/server-fns';
import { LearnDone } from '../../../../../features/learning/ui/learn-done';
import { LearnPass } from '../../../../../features/learning/ui/learn-pass';
import { parsePracticeSearch } from '../../../../../features/practice/schemas/session-request';
import {
  directionOptions,
  resolveAnswerDirection,
} from '../../../../../features/practice/services/session-options';
import { SessionStart } from '../../../../../features/practice/ui/session-start';
import { directionLabel } from '../../../../../shared/directions';
import { attachPreparedExamples } from '../../../../../shared/examples/example-model';
import { countNoun } from '../../../../../shared/format/count';
import { germanLabels } from '../../../../../shared/languages';
import { itemsInNextSection } from '../../../../../shared/session/section-policy';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../shared/ui/back-link';
import { PageLayout } from '../../../../../shared/ui/page-layout';
import { LearnCompletionControls } from './-learn-completion-controls';

const LearnUnitScreen = () => {
  const { availableDirections, course, direction, pass } =
    Route.useLoaderData();
  const router = useRouter();
  const targetLabel = germanLabels[course.targetLanguage];
  const items = pass.items.filter((item) => item.direction === direction);
  const chooseDirection = pass.items.length > 0 && direction === undefined;
  const nextDirection = availableDirections.find(
    (candidate) => candidate !== direction,
  );
  const next =
    nextDirection === undefined
      ? null
      : {
          direction: nextDirection,
          count: itemsInNextSection(
            pass.directions.find(
              (candidate) => candidate.direction === nextDirection,
            )?.unintroduced ?? 0,
          ),
        };
  const currentRemaining = Math.max(
    0,
    (pass.directions.find((candidate) => candidate.direction === direction)
      ?.unintroduced ?? 0) - items.length,
  );
  let content: ReactNode;
  if (chooseDirection) {
    content = (
      <SessionStart
        itemNoun={{ singular: 'Vokabel', plural: 'Vokabeln' }}
        options={directionOptions(
          availableDirections,
          targetLabel,
          availableDirections.map((candidate) => ({
            direction: candidate,
            ready: pass.items.filter((item) => item.direction === candidate)
              .length,
          })),
        )}
        preferenceKey={`${course.id}:learn`}
        renderStartAction={(option, rememberDirection) => (
          <ActionLink
            className="w-fit"
            onClick={rememberDirection}
            params={{ courseId: course.id, unitId: pass.unit.id }}
            search={{ direction: option.value }}
            to="/courses/$courseId/units/$unitId/learn"
          >
            {countNoun(option.cards, 'Vokabel', 'Vokabeln')} kennenlernen
          </ActionLink>
        )}
      />
    );
  } else if (direction === undefined) {
    content = (
      <LearnDone
        controls={
          <ActionLink
            params={{ courseId: course.id }}
            search={{ unit: pass.unit.id }}
            to="/courses/$courseId/study"
          >
            Einheit üben
          </ActionLink>
        }
        directionLabel={null}
        learned={0}
      />
    );
  } else {
    content = (
      <LearnPass
        completionControls={
          <LearnCompletionControls
            courseId={course.id}
            current={direction}
            currentRemaining={currentRemaining}
            next={next}
            onContinueCurrent={() => router.invalidate({ sync: true })}
            targetLabel={targetLabel}
            unitId={pass.unit.id}
          />
        }
        directionLabel={directionLabel(direction, targetLabel)}
        items={items}
        key={`${direction}:${items.map((item) => item.cardId).join('|')}`}
        onIntroduce={async (item) => {
          await introduceCard({
            data: {
              courseId: course.id,
              unitId: pass.unit.id,
              cardId: item.cardId,
            },
          });
        }}
        targetLabel={targetLabel}
        targetLanguage={course.targetLanguage}
      />
    );
  }

  return (
    <PageLayout
      backControl={
        <BackLink
          params={{ courseId: course.id, unitId: pass.unit.id }}
          to="/courses/$courseId/units/$unitId"
        >
          {pass.unit.name}
        </BackLink>
      }
      title={`${pass.unit.name} kennenlernen`}
    >
      {content}
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/learn')({
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({ direction: search.direction }),
  loader: async ({ params, deps }) => {
    const [course, pass] = await Promise.all([
      getCourse({ data: params.courseId }),
      getLearnPass({
        data: { courseId: params.courseId, unitId: params.unitId },
      }),
    ]);
    const availableDirections = pass.directions.map(
      (progress) => progress.direction,
    );
    const direction = resolveAnswerDirection(
      deps.direction,
      availableDirections,
    );
    const prepared =
      direction === undefined
        ? []
        : await prepareVocabularyExamples({
            data: pass.items
              .filter((item) => item.direction === direction)
              .map((item) => item.entryId),
          });
    return {
      availableDirections,
      course,
      direction,
      pass: { ...pass, items: attachPreparedExamples(pass.items, prepared) },
    };
  },
  component: LearnUnitScreen,
});
