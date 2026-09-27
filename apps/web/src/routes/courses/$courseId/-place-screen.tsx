import { useRouter } from '@tanstack/react-router';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type {
  VocabularyEntry,
  WordProgress,
} from '../../../features/courses/schemas/course-units';
import {
  createVocabularyEntry,
  generateVocabularyDraftExample,
  generateVocabularyExample,
  suggestVocabularyTranslation,
  translateVocabularyDraftExample,
} from '../../../features/courses/services/server-fns';
import { DirectionPlan } from '../../../features/courses/ui/direction-plan';
import { PlaceVocabulary } from '../../../features/courses/ui/place-vocabulary';
import type { WordPlace } from '../../../features/courses/ui/word-places';
import { directionLabel } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { readyCardsInNextSection } from '../../../shared/practice/session-policy';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import type { PlaceSelectionData } from '../../../shared/session/vocabulary-selection';
import { ActionLink } from '../../../shared/ui/action-link';
import { PlaceLearnLink, placeSearch } from './-course-place';

// The screens of a book and of a unit share their learning paths and their
// word list; only what they cover differs.

const placeSelection = ({ bookId, unitId }: WordPlace): PlaceSelectionData =>
  unitId === null ? { bookId } : { unitId };

type PlaceDirectionPlanProps = {
  readonly courseId: string;
  readonly place: WordPlace;
  readonly progress: WordProgress;
  readonly targetLabel: string;
};

export const PlaceDirectionPlan = ({
  courseId,
  place,
  progress,
  targetLabel,
}: PlaceDirectionPlanProps) => {
  const selection = placeSelection(place);
  return (
    <DirectionPlan
      progress={progress}
      renderLearnAction={(direction, variant) => (
        <PlaceLearnLink
          className="w-full sm:w-fit"
          courseId={courseId}
          direction={direction.direction}
          selection={selection}
          variant={variant}
        >
          {`${countNoun(
            itemsInNextSection(direction.unintroduced),
            'Vokabel',
            'Vokabeln',
          )} kennenlernen${
            variant === 'primary'
              ? ` · ${directionLabel(direction.direction, targetLabel)}`
              : ''
          }`}
        </PlaceLearnLink>
      )}
      renderScheduledAction={(direction, variant) => (
        <ActionLink
          className="w-full sm:w-fit"
          params={{ courseId }}
          search={{ direction: direction.direction, ...placeSearch(selection) }}
          to="/courses/$courseId/practice"
          variant={variant}
        >
          {countNoun(
            readyCardsInNextSection(direction.due, direction.firstReviews),
            'Karte',
            'Karten',
          )}{' '}
          üben · {directionLabel(direction.direction, targetLabel)}
        </ActionLink>
      )}
      targetLabel={targetLabel}
    />
  );
};

type PlaceWordsProps = {
  readonly courseId: string;
  readonly place: WordPlace;
  readonly targetLanguage: LanguageCode;
  readonly targetLabel: string;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly courseEntries: ReadonlyArray<VocabularyEntry>;
};

export const PlaceWords = ({
  courseId,
  place,
  targetLanguage,
  targetLabel,
  enabledDirections,
  entries,
  courseEntries,
}: PlaceWordsProps) => {
  const router = useRouter();
  const selection = placeSelection(place);
  return (
    <PlaceVocabulary
      courseEntries={courseEntries}
      createEntry={async (draft) => {
        const created = await createVocabularyEntry({
          data: { courseId, ...place, ...draft },
        });
        await router.invalidate();
        return created;
      }}
      enabledDirections={enabledDirections}
      entries={entries}
      generateDraftExample={(targetText, nativeText) =>
        generateVocabularyDraftExample({
          data: { courseId, targetText, nativeText },
        })
      }
      generateExample={(entryId) =>
        generateVocabularyExample({ data: entryId })
      }
      importAction={
        <ActionLink params={{ courseId }} to="/courses/$courseId/import">
          Seite fotografieren
        </ActionLink>
      }
      place={place.unitId === null ? 'book' : 'unit'}
      renderStudyAction={(entryIds, intent) => (
        <ActionLink
          params={{ courseId }}
          search={
            entryIds.length === entries.length
              ? { mode: intent, ...placeSearch(selection) }
              : { entries: entryIds.join(','), mode: intent }
          }
          to="/courses/$courseId/study"
        >
          Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
        </ActionLink>
      )}
      suggestTranslation={(text, given) =>
        suggestVocabularyTranslation({
          data: { courseId, ...place, text, given },
        })
      }
      targetLabel={targetLabel}
      targetLanguage={targetLanguage}
      translateDraftExample={(targetText) =>
        translateVocabularyDraftExample({ data: { courseId, targetText } })
      }
    />
  );
};
