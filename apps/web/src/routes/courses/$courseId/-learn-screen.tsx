import { redirect, useRouter } from '@tanstack/react-router';
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
import {
  courseNouns,
  directionLabel,
  isListCourse,
} from '../../../shared/directions';
import { attachPreparedExamples } from '../../../shared/examples/example-model';
import { countNoun } from '../../../shared/format/count';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import type { PlaceSelectionData } from '../../../shared/session/vocabulary-selection';
import { ActionLink } from '../../../shared/ui/action-link';
import { FocusLayout } from '../../../shared/ui/focus-layout';
import {
  PlaceBackLink,
  PlaceLearnLink,
  PlacePageLink,
  placeSearch,
} from './-course-place';
import { LearnCompletionControls } from './-learn-completion-controls';

// The learning pass for the words directly in a book, for one unit, or for a
// whole course when the selection is null. Every learn route loads and
// renders it the same way.
export const loadLearnScreen = async (
  courseId: string,
  selection: PlaceSelectionData | null,
  requestedDirection: SessionDirection | undefined,
) => {
  const [course, pass] = await Promise.all([
    getCourse({ data: courseId }),
    getLearnPass({
      data: { courseId, ...(selection === null ? {} : { place: selection }) },
    }),
  ]);
  // A subject or collection keeps its entries in one list, so they are
  // learned from that list and never from the book that holds them.
  if (isListCourse(course.kind) && selection !== null) {
    throw redirect({
      to: '/courses/$courseId/learn',
      params: { courseId },
      search: { direction: requestedDirection },
    });
  }
  const availableDirections = pass.directions.map(
    (progress) => progress.direction,
  );
  const direction = resolveAnswerDirection(
    requestedDirection,
    availableDirections,
  );
  // A definition or text has no example sentence to show.
  const prepared =
    direction === undefined || isListCourse(course.kind)
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

type LearnDoneControlsProps = {
  readonly courseId: string;
  readonly name: string;
  readonly selection: PlaceSelectionData | null;
};

// With nothing left to learn, a book or unit can still be practised freely.
// A whole course has no such selection, so it leads back to its page.
const LearnDoneControls = ({
  courseId,
  name,
  selection,
}: LearnDoneControlsProps) => {
  if (selection === null) {
    return (
      <PlacePageLink courseId={courseId} selection={null} variant="primary">
        Zurück zu {name}
      </PlacePageLink>
    );
  }
  return (
    <ActionLink
      params={{ courseId }}
      search={placeSearch(selection)}
      to="/courses/$courseId/study"
    >
      {'bookId' in selection ? 'Buch üben' : 'Einheit üben'}
    </ActionLink>
  );
};

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
          <LearnDoneControls
            courseId={course.id}
            name={pass.name}
            selection={selection}
          />
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
