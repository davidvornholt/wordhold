import { useMatchRoute, useRouter, useSearch } from '@tanstack/react-router';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import { prepareVocabularyExamples } from '../../../features/courses/services/server-fns';
import { prepareSpellingPitfalls } from '../../../features/courses/services/spelling-pitfall-server-fns';
import type { LearnSelectionPass } from '../../../features/learning/schemas/learning-models';
import { introduceCard } from '../../../features/learning/services/server-fns';
import { LearnPass } from '../../../features/learning/ui/learn-pass';
import { directionOptions } from '../../../features/practice/services/session-options';
import { SessionStart } from '../../../features/practice/ui/session-start';
import {
  type CourseSubject,
  courseNouns,
  directionLabel,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import type { ActionVariant } from '../../../shared/ui/action-styles';
import { cardClass } from '../../../shared/ui/surface-styles';
import { ContinueLearningButton } from './-learn-completion-controls';
import { studySearch } from './-study-link';

type StudyLearningProps = {
  readonly courseId: string;
  readonly direction: AnswerDirection | undefined;
  readonly pass: LearnSelectionPass;
  readonly subject: CourseSubject;
};

type StudyLearnLinkProps = {
  readonly courseId: string;
  readonly direction: AnswerDirection;
  readonly variant?: ActionVariant;
  readonly className?: string;
  readonly onClick?: () => void;
  readonly children: ReactNode;
};

// Learns the same selection in a direction, keeping where it came from. Like
// PlaceLearnLink, it says so while its own learning pass is loading.
const StudyLearnLink = ({
  courseId,
  direction,
  variant,
  className,
  onClick,
  children,
}: StudyLearnLinkProps) => {
  const search = studySearch(
    'learn',
    direction,
  )(useSearch({ from: '/courses/$courseId/study' }));
  const matchRoute = useMatchRoute();
  const preparing =
    matchRoute({
      to: '/courses/$courseId/study',
      params: { courseId },
      search,
      pending: true,
    }) !== false;
  return (
    <ActionLink
      aria-busy={preparing}
      className={className}
      onClick={onClick}
      params={{ courseId }}
      search={search}
      to="/courses/$courseId/study"
      variant={variant}
    >
      {/* biome-ignore lint/suspicious/noLeakedRender: children is the link's own label, shown whenever it is not loading; nothing is rendered by accident. */}
      {preparing ? 'Wird vorbereitet …' : children}
    </ActionLink>
  );
};

export const StudyLearning = ({
  courseId,
  direction,
  pass,
  subject,
}: StudyLearningProps) => {
  const router = useRouter();
  const nouns = courseNouns(subject);
  const availableDirections = pass.directions.map(
    (progress) => progress.direction,
  );
  const items = pass.items.filter((item) => item.direction === direction);
  const nextDirection = availableDirections.find(
    (candidate) => candidate !== direction,
  );
  const nextCount =
    pass.directions.find((candidate) => candidate.direction === nextDirection)
      ?.unintroduced ?? 0;
  const currentRemaining = Math.max(
    0,
    (pass.directions.find((candidate) => candidate.direction === direction)
      ?.unintroduced ?? 0) - items.length,
  );
  let content: ReactNode;
  if (pass.items.length > 0 && direction === undefined) {
    content = (
      <SessionStart
        itemNoun={nouns}
        options={directionOptions(
          availableDirections,
          subject,
          availableDirections.map((candidate) => ({
            direction: candidate,
            ready: pass.items.filter((item) => item.direction === candidate)
              .length,
          })),
        )}
        preferenceKey={`${courseId}:learn`}
        renderStartAction={(option, rememberDirection) => {
          if (option.value === 'both') {
            return null;
          }
          return (
            <StudyLearnLink
              className="w-fit"
              courseId={courseId}
              onClick={rememberDirection}
              direction={option.value}
            >
              {countNoun(option.cards, nouns.singular, nouns.plural)}{' '}
              kennenlernen
            </StudyLearnLink>
          );
        }}
      />
    );
  } else if (direction === undefined) {
    content = (
      <div className={`flex flex-col items-start gap-3 ${cardClass}`}>
        <p>Diese Auswahl ist bereits kennengelernt.</p>
        <ActionLink
          params={{ courseId }}
          from="/courses/$courseId/study"
          search={studySearch('practice')}
          to="/courses/$courseId/study"
        >
          Auswahl üben
        </ActionLink>
      </div>
    );
  } else {
    content = (
      <LearnPass
        completionControls={
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
            <ActionLink
              params={{ courseId }}
              from="/courses/$courseId/study"
              search={studySearch('practice', direction)}
              to="/courses/$courseId/study"
            >
              Jetzt üben · {directionLabel(direction, subject)}
            </ActionLink>
            {currentRemaining === 0 ? null : (
              <ContinueLearningButton
                onContinue={() => router.invalidate({ sync: true })}
              >
                Weitere{' '}
                {countNoun(
                  itemsInNextSection(currentRemaining),
                  nouns.singular,
                  nouns.plural,
                )}{' '}
                kennenlernen · {directionLabel(direction, subject)}
              </ContinueLearningButton>
            )}
            {nextDirection === undefined ? null : (
              <StudyLearnLink
                courseId={courseId}
                direction={nextDirection}
                variant="outline"
              >
                {countNoun(
                  itemsInNextSection(nextCount),
                  nouns.singular,
                  nouns.plural,
                )}{' '}
                kennenlernen · {directionLabel(nextDirection, subject)}
              </StudyLearnLink>
            )}
          </div>
        }
        directionLabel={directionLabel(direction, subject)}
        items={items}
        key={`${direction}:${items.map((item) => item.cardId).join('|')}`}
        onIntroduce={async (item) => {
          await introduceCard({
            data: { cardId: item.cardId, courseId },
          });
        }}
        prepareExamples={prepareVocabularyExamples}
        preparePitfalls={prepareSpellingPitfalls}
        subject={subject}
      />
    );
  }
  return content;
};
