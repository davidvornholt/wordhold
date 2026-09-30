import {
  createFileRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { useState } from 'react';
import {
  getCourseDirections,
  getCourseOutline,
  prepareVocabularyExamples,
} from '../../../features/courses/services/server-fns';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { remainingReadyCount } from '../../../features/practice/schemas/practice-models';
import { parsePracticeSearch } from '../../../features/practice/schemas/session-request';
import {
  getPracticeSession,
  submitAnswer,
} from '../../../features/practice/services/server-fns';
import {
  resolveSessionDirection,
  sessionOptions,
} from '../../../features/practice/services/session-options';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { countNoun } from '../../../shared/format/count';
import { readyCardsInNextSection } from '../../../shared/practice/session-policy';
import { focusShell } from '../../../shared/routing/shell';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { Button } from '../../../shared/ui/button';
import { FocusLayout } from '../../../shared/ui/focus-layout';
import {
  findCoursePlace,
  PlaceBackLink,
  PlacePageLink,
  placeSearch,
} from './-course-place';

const PracticeScreen = () => {
  const { availability, course, directions, direction, place, session } =
    Route.useLoaderData();
  const router = useRouter();
  const navigating = useRouterState({ select: (state) => state.isLoading });
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const pageBackControl =
    place === undefined ? (
      <BackLink to="/">Übersicht</BackLink>
    ) : (
      <PlaceBackLink courseId={course.id} selection={place.selection}>
        {place.name}
      </PlaceBackLink>
    );
  const sessionBackControl =
    place === undefined ? (
      <ActionLink to="/" variant="quiet-muted">
        Zurück zur Übersicht
      </ActionLink>
    ) : (
      <PlacePageLink
        courseId={course.id}
        selection={place.selection}
        variant="quiet-muted"
      >
        Zurück zu {place.name}
      </PlacePageLink>
    );

  return (
    <FocusLayout
      exit={pageBackControl}
      title={`${place?.name ?? course.name} · Üben`}
    >
      {session === null ? (
        <SessionStart
          itemNoun={{ singular: 'Karte', plural: 'Karten' }}
          options={sessionOptions(directions, course, [
            ...availability.directions,
            { direction: 'both', ready: availability.ready },
          ])}
          preferenceKey={`${course.id}:practice`}
          renderStartAction={(option, rememberDirection) => (
            <ActionLink
              aria-busy={navigating}
              className="w-fit"
              onClick={rememberDirection}
              params={{ courseId: course.id }}
              search={{
                direction: option.value,
                ...(place === undefined ? {} : placeSearch(place.selection)),
              }}
              to="/courses/$courseId/practice"
            >
              {navigating
                ? 'Wird vorbereitet …'
                : `${countNoun(option.cards, 'Karte', 'Karten')} starten`}
            </ActionLink>
          )}
        />
      ) : (
        <SessionRunner
          backControl={sessionBackControl}
          continueControl={
            <Button
              onClick={async () => {
                await router.invalidate();
                setSessionGeneration((current) => current + 1);
              }}
            >
              {remainingReadyCount(session) > 0
                ? `Weitere ${itemsInNextSection(remainingReadyCount(session))} üben`
                : 'Weiter üben'}
            </Button>
          }
          emptyMessage="Für jetzt geschafft"
          key={`${direction}-${sessionGeneration}-${session.items
            .map((item) => `${item.cardId}-${item.revision}`)
            .join('|')}`}
          mode="scheduled"
          prepareExamples={prepareVocabularyExamples}
          session={session}
          subject={course}
          submit={submitAnswer}
        />
      )}
    </FocusLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/practice')({
  staticData: focusShell,
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({
    direction: search.direction,
    book: search.book,
    unit: search.unit,
  }),
  loader: async ({ params, deps }) => {
    const [course, directions, dashboard, outline] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      getDashboard(),
      getCourseOutline({ data: params.courseId }),
    ]);
    const place = findCoursePlace(outline, deps);
    const stats = dashboard.perCourse.find(
      (courseStats) => courseStats.courseId === course.id,
    );
    const directionAvailability =
      place?.directions.map((progress) => ({
        direction: progress.direction,
        ready: readyCardsInNextSection(progress.due, progress.firstReviews),
      })) ??
      stats?.directions ??
      [];
    const placeDue =
      place?.directions.reduce((total, progress) => total + progress.due, 0) ??
      0;
    const placeFirstReviews =
      place?.directions.reduce(
        (total, progress) => total + progress.firstReviews,
        0,
      ) ?? 0;
    const ready =
      place === undefined
        ? (stats?.ready ?? 0)
        : readyCardsInNextSection(placeDue, placeFirstReviews);
    const readyDirections = directionAvailability
      .filter((candidate) => candidate.ready > 0)
      .map((candidate) => candidate.direction);
    const direction = resolveSessionDirection(
      deps.direction,
      directions,
      readyDirections,
    );
    // Example sentences are prepared in the background once the sitting is
    // on screen (see useExampleWarmup); waiting for them here made the start
    // button appear to do nothing for seconds.
    const session =
      direction === undefined
        ? null
        : await getPracticeSession({
            data: {
              courseId: params.courseId,
              direction,
              place: place?.selection,
            },
          });
    return {
      availability: { directions: directionAvailability, ready },
      course,
      directions,
      direction,
      place,
      session,
    };
  },
  component: PracticeScreen,
});
