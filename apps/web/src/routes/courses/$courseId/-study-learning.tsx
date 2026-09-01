import { useRouter } from '@tanstack/react-router';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import type { LearnSelectionPass } from '../../../features/learning/schemas/learning-models';
import { introduceCard } from '../../../features/learning/services/server-fns';
import { LearnPass } from '../../../features/learning/ui/learn-pass';
import { directionOptions } from '../../../features/practice/services/session-options';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { directionLabel } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import type { VocabularySelectionData } from '../../../shared/session/vocabulary-selection';
import { ActionLink } from '../../../shared/ui/action-link';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';

type StudyLearningProps = {
  readonly courseId: string;
  readonly direction: AnswerDirection | undefined;
  readonly pass: LearnSelectionPass;
  readonly selection: VocabularySelectionData;
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
};

const selectionSearch = (
  selection: VocabularySelectionData,
  mode: 'learn' | 'practice',
  direction?: AnswerDirection,
) => ({
  direction,
  entries: 'entryIds' in selection ? selection.entryIds.join(',') : undefined,
  mode,
  unit: 'unitId' in selection ? selection.unitId : undefined,
});

export const StudyLearning = ({
  courseId,
  direction,
  pass,
  selection,
  targetLabel,
  targetLanguage,
}: StudyLearningProps) => {
  const router = useRouter();
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
        preferenceKey={`${courseId}:learn`}
        renderStartAction={(option, rememberDirection) => {
          if (option.value === 'both') {
            return null;
          }
          return (
            <ActionLink
              className="w-fit"
              onClick={rememberDirection}
              params={{ courseId }}
              search={selectionSearch(selection, 'learn', option.value)}
              to="/courses/$courseId/study"
            >
              {countNoun(option.cards, 'Vokabel', 'Vokabeln')} kennenlernen
            </ActionLink>
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
          search={selectionSearch(selection, 'practice')}
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
              search={selectionSearch(selection, 'practice', direction)}
              to="/courses/$courseId/study"
            >
              Jetzt üben · {directionLabel(direction, targetLabel)}
            </ActionLink>
            {currentRemaining === 0 ? null : (
              <Button
                onClick={() => router.invalidate({ sync: true })}
                variant="outline"
              >
                Weitere{' '}
                {countNoun(
                  itemsInNextSection(currentRemaining),
                  'Vokabel',
                  'Vokabeln',
                )}{' '}
                kennenlernen · {directionLabel(direction, targetLabel)}
              </Button>
            )}
            {nextDirection === undefined ? null : (
              <ActionLink
                params={{ courseId }}
                search={selectionSearch(selection, 'learn', nextDirection)}
                to="/courses/$courseId/study"
                variant="outline"
              >
                {countNoun(
                  itemsInNextSection(nextCount),
                  'Vokabel',
                  'Vokabeln',
                )}{' '}
                kennenlernen · {directionLabel(nextDirection, targetLabel)}
              </ActionLink>
            )}
          </div>
        }
        directionLabel={directionLabel(direction, targetLabel)}
        items={items}
        key={`${direction}:${items.map((item) => item.cardId).join('|')}`}
        onIntroduce={async (item) => {
          await introduceCard({
            data: {
              cardId: item.cardId,
              courseId,
              unitId: item.unitId,
            },
          });
        }}
        targetLabel={targetLabel}
        targetLanguage={targetLanguage}
      />
    );
  }
  return content;
};
