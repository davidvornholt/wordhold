import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { useId } from 'react';
import type {
  VocabularyEntry,
  WordProgress,
} from '../../../features/courses/schemas/course-units';
import { DirectionPlan } from '../../../features/courses/ui/direction-plan';
import { PlaceVocabulary } from '../../../features/courses/ui/place-vocabulary';
import type { WordPlace } from '../../../features/courses/ui/word-places';
import {
  type CourseSubject,
  courseNouns,
  directionLabel,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { germanLabels } from '../../../shared/languages';
import { readyCardsInNextSection } from '../../../shared/practice/session-policy';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import type { PlaceSelectionData } from '../../../shared/session/vocabulary-selection';
import { ActionLink } from '../../../shared/ui/action-link';
import { PlaceLearnLink, placeSearch } from './-course-place';
import {
  type EntryCourse,
  useCourseEntryActions,
  VocabularyEntryForm,
} from './-entry-forms';
import { SelectionActions } from './-selection-actions';

// The screens of a book and of a unit share their learning paths and their
// word list; only what they cover differs.

const placeSelection = ({ bookId, unitId }: WordPlace): PlaceSelectionData =>
  unitId === null ? { bookId } : { unitId };

type PlaceDirectionPlanProps = {
  readonly courseId: string;
  readonly place: WordPlace;
  readonly progress: WordProgress;
  readonly subject: CourseSubject;
};

export const PlaceDirectionPlan = ({
  courseId,
  place,
  progress,
  subject,
}: PlaceDirectionPlanProps) => {
  const selection = placeSelection(place);
  const nouns = courseNouns(subject);
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
            nouns.singular,
            nouns.plural,
          )} kennenlernen${
            variant === 'primary'
              ? ` · ${directionLabel(direction.direction, subject)}`
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
          üben · {directionLabel(direction.direction, subject)}
        </ActionLink>
      )}
      subject={subject}
    />
  );
};

// Extra practice with the words already met: it opens once any word here is
// introduced, in either direction, and leaves the schedule untouched.
export const PlaceSentencePractice = ({
  courseId,
  place,
  progress,
  subject,
}: PlaceDirectionPlanProps) => {
  const headingId = useId();
  if (
    subject.kind !== 'language' ||
    !progress.directions.some((direction) => direction.introduced > 0)
  ) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl" id={headingId}>
          Satzübung
        </h2>
        <p className="text-muted-foreground text-sm">
          Übersetze Beispielsätze zu Wörtern, die du schon kennengelernt hast,
          auf {germanLabels[subject.targetLanguage]}. Die KI prüft deine
          Übersetzung; Lernstand und Termine bleiben unverändert.
        </p>
      </div>
      <ActionLink
        className="w-full sm:w-fit"
        params={{ courseId }}
        search={placeSearch(placeSelection(place))}
        to="/courses/$courseId/sentences"
        variant="outline"
      >
        Sätze übersetzen
      </ActionLink>
    </section>
  );
};

type PlaceWordsProps = {
  readonly course: EntryCourse;
  readonly place: WordPlace;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly courseEntries: ReadonlyArray<VocabularyEntry>;
};

export const PlaceWords = ({
  course,
  place,
  enabledDirections,
  entries,
  courseEntries,
}: PlaceWordsProps) => {
  const courseId = course.id;
  const selection = placeSelection(place);
  const entryActions = useCourseEntryActions(course, courseEntries);
  return (
    <PlaceVocabulary
      enabledDirections={enabledDirections}
      entries={entries}
      entryActions={entryActions}
      entryForm={
        <VocabularyEntryForm
          course={course}
          entries={courseEntries}
          place={place}
        />
      }
      importAction={
        <ActionLink params={{ courseId }} to="/courses/$courseId/import">
          Seite fotografieren
        </ActionLink>
      }
      place={place.unitId === null ? 'book' : 'unit'}
      renderStudyAction={(entryIds, intent) => (
        <SelectionActions
          courseId={courseId}
          intent={intent}
          search={
            entryIds.length === entries.length
              ? placeSearch(selection)
              : { entries: entryIds.join(',') }
          }
          sentences={course.kind === 'language'}
        />
      )}
      subject={course}
    />
  );
};
