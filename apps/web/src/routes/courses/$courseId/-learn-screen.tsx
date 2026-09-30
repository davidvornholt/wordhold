import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { prepareVocabularyExamples } from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import {
  getLearnPass,
  introduceCard,
} from '../../../features/learning/services/server-fns';
import { LearnDone } from '../../../features/learning/ui/learn-done';
import { LearnPass } from '../../../features/learning/ui/learn-pass';
import type { SessionDirection } from '../../../features/practice/schemas/session-request';
import {
  directionOptions,
  resolveAnswerDirection,
} from '../../../features/practice/services/session-options';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { courseNouns, directionLabel } from '../../../shared/directions';
import { attachPreparedExamples } from '../../../shared/examples/example-model';
import { countNoun } from '../../../shared/format/count';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import type { PlaceSelectionData } from '../../../shared/session/vocabulary-selection';
import { ActionLink } from '../../../shared/ui/action-link';
import { FocusLayout } from '../../../shared/ui/focus-layout';
import { PlaceBackLink, PlaceLearnLink, placeSearch } from './-course-place';
import { LearnCompletionControls } from './-learn-completion-controls';

// The learning pass for the words directly in a book or for one unit. Both
// learn routes load and render it the same way.
export const loadLearnScreen = async (
  courseId: string,
  selection: PlaceSelectionData,
  requestedDirection: SessionDirection | undefined,
) => {
  const [course, pass] = await Promise.all([
    getCourse({ data: courseId }),
    getLearnPass({ data: { courseId, place: selection } }),
  ]);
  const availableDirections = pass.directions.map(
    (progress) => progress.direction,
  );
  const direction = resolveAnswerDirection(
    requestedDirection,
    availableDirections,
  );
  // A definition has no example sentence to show.
  const prepared =
    direction === undefined || course.kind === 'terms'
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
    selection,
  };
};

type LearnScreenProps = Awaited<ReturnType<typeof loadLearnScreen>>;

export const LearnScreen = ({
  availableDirections,
  course,
  direction,
  pass,
  selection,
}: LearnScreenProps) => {
  const router = useRouter();
  const nouns = courseNouns(course);
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
        itemNoun={nouns}
        options={directionOptions(
          availableDirections,
          course,
          availableDirections.map((candidate) => ({
            direction: candidate,
            ready: pass.items.filter((item) => item.direction === candidate)
              .length,
          })),
        )}
        preferenceKey={`${course.id}:learn`}
        renderStartAction={(option, rememberDirection) =>
          option.value === 'both' ? null : (
            <PlaceLearnLink
              className="w-fit"
              courseId={course.id}
              direction={option.value}
              onClick={rememberDirection}
              selection={selection}
            >
              {countNoun(option.cards, nouns.singular, nouns.plural)}{' '}
              kennenlernen
            </PlaceLearnLink>
          )
        }
      />
    );
  } else if (direction === undefined) {
    content = (
      <LearnDone
        controls={
          <ActionLink
            params={{ courseId: course.id }}
            search={placeSearch(selection)}
            to="/courses/$courseId/study"
          >
            {'bookId' in selection ? 'Buch üben' : 'Einheit üben'}
          </ActionLink>
        }
        directionLabel={null}
        learned={0}
        nouns={nouns}
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
            selection={selection}
            subject={course}
          />
        }
        directionLabel={directionLabel(direction, course)}
        items={items}
        key={`${direction}:${items.map((item) => item.cardId).join('|')}`}
        onIntroduce={async (item) => {
          await introduceCard({
            data: { courseId: course.id, cardId: item.cardId },
          });
        }}
        subject={course}
      />
    );
  }

  return (
    <FocusLayout
      exit={
        <PlaceBackLink courseId={course.id} selection={selection}>
          {pass.name}
        </PlaceBackLink>
      }
      title={`${pass.name} · Kennenlernen`}
    >
      {content}
    </FocusLayout>
  );
};
