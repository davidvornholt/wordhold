import { useRef, useState } from 'react';
import type {
  CourseOutline,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { UnitDirectionPlan } from '../src/features/courses/ui/unit-direction-plan';
import { unitProgressSummary } from '../src/features/courses/ui/unit-status';
import { UnitVocabulary } from '../src/features/courses/ui/unit-vocabulary';
import { directionLabel } from '../src/shared/directions';
import { countNoun } from '../src/shared/format/count';
import { itemsInNextSection } from '../src/shared/session/section-policy';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import {
  courseOutline,
  currentBook,
  dueUnit,
  emptyUnit,
  mixedUnit,
  targetLabel,
  unintroducedUnit,
} from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const coursePrimaryAction = (
  emptyVocabulary: boolean,
  practiceAvailable: boolean,
) => {
  if (emptyVocabulary) {
    return fixtureControl('Seite fotografieren', 'import', 'primary');
  }
  return practiceAvailable
    ? fixtureControl('6 Karten üben', 'practice', 'primary')
    : fixtureControl(
        '2 Vokabeln kennenlernen · Englisch → Deutsch',
        'learn',
        'primary',
      );
};

type CourseFixtureProps = {
  readonly emptyVocabulary?: boolean;
  readonly practiceAvailable?: boolean;
  readonly withoutBooks?: boolean;
};

const initialOutline = ({
  emptyVocabulary,
  withoutBooks,
}: CourseFixtureProps): CourseOutline => {
  if (withoutBooks === true) {
    return { books: [], units: [] };
  }
  return emptyVocabulary === true
    ? { books: [currentBook], units: [emptyUnit] }
    : courseOutline;
};

// Book and unit edits change an in-memory outline, the way the server returns
// the course's new outline after each change.
const useFixtureOutline = (props: CourseFixtureProps) => {
  const outlineRef = useRef(initialOutline(props));
  const update = (
    change: (current: CourseOutline) => CourseOutline,
  ): Promise<CourseOutline> => {
    outlineRef.current = change(outlineRef.current);
    return Promise.resolve(outlineRef.current);
  };
  return {
    outline: outlineRef.current,
    createBook: (name: string) =>
      update((current) => ({
        ...current,
        books: [...current.books, { id: crypto.randomUUID(), name }],
      })),
    renameBook: (bookId: string, name: string) =>
      update((current) => ({
        ...current,
        books: current.books.map((book) =>
          book.id === bookId ? { ...book, name } : book,
        ),
      })),
    createUnit: (bookId: string, name: string) =>
      update((current) => ({
        ...current,
        units: [
          ...current.units,
          { ...emptyUnit, bookId, id: crypto.randomUUID(), name },
        ],
      })),
    reorderUnits: (
      bookId: string,
      _expectedUnitIds: ReadonlyArray<string>,
      unitIds: ReadonlyArray<string>,
    ) =>
      update((current) => ({
        ...current,
        units: [
          ...current.units.filter((unit) => unit.bookId !== bookId),
          ...unitIds.flatMap((unitId) =>
            current.units.filter((unit) => unit.id === unitId),
          ),
        ],
      })),
  };
};

export const CourseFixture = ({
  emptyVocabulary = false,
  practiceAvailable = true,
  withoutBooks = false,
}: CourseFixtureProps) => {
  const outline = useFixtureOutline({ emptyVocabulary, withoutBooks });
  const noVocabulary = emptyVocabulary || withoutBooks;
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard')}
      title="English A2"
    >
      <CourseOverview
        {...outline}
        importAction={
          noVocabulary
            ? null
            : fixtureControl('Seite fotografieren', 'import', 'quiet')
        }
        languageLabel="Englisch"
        primaryAction={coursePrimaryAction(noVocabulary, practiceAvailable)}
        renderUnitLink={(unit) => fixtureControl(unit.name, 'unit', 'quiet')}
        settingsAction={fixtureControl(
          'Einstellungen',
          'course-settings',
          'quiet',
        )}
        targetLabel={targetLabel}
        vocabularyAction={fixtureControl('Vokabelliste', 'vocabulary', 'quiet')}
      />
    </PageLayout>
  );
};

const uuidTailLength = 12;
const entryIdOffset = 100;
const cardIdOffset = 200;

const fixtureId = (offset: number, index: number): string =>
  `00000000-0000-4000-8000-${String(offset + index).padStart(uuidTailLength, '0')}`;

const unitEntry = (
  index: number,
  target: string,
  native: string,
  introduced: boolean,
): VocabularyEntry => ({
  id: fixtureId(entryIdOffset, index),
  bookId: currentBook.id,
  bookName: currentBook.name,
  unitId: mixedUnit.id,
  unitName: mixedUnit.name,
  targetText: target,
  nativeText: native,
  example: null,
  introduced,
  cards: [
    {
      cardId: fixtureId(cardIdOffset, index),
      direction: 'to_target',
      state: introduced ? 'review' : 'new',
      dueAt: introduced ? new Date('2026-08-28T10:00:00Z') : null,
      introducedAt: introduced ? new Date('2026-08-20T10:00:00Z') : null,
      failures: 0,
    },
  ],
});

type UnitFixtureProps = {
  readonly state?: 'mixed' | 'unintroduced' | 'due' | 'empty';
};

const unitsByState = {
  mixed: mixedUnit,
  unintroduced: unintroducedUnit,
  due: dueUnit,
  empty: emptyUnit,
} as const;

const entriesByState: Record<
  NonNullable<UnitFixtureProps['state']>,
  ReadonlyArray<VocabularyEntry>
> = {
  mixed: [
    unitEntry(1, 'memory', 'die Erinnerung', true),
    unitEntry(2, 'holiday', 'die Ferien', false),
  ],
  unintroduced: Array.from({ length: unintroducedUnit.entries }, (_, index) =>
    unitEntry(
      index + 1,
      `new word ${index + 1}`,
      `neues Wort ${index + 1}`,
      false,
    ),
  ),
  due: [unitEntry(1, 'memory', 'die Erinnerung', true)],
  empty: [],
};

// One unit screen holds both learning paths and its selectable vocabulary.
// Typed entries join the list in memory so the add flow can be exercised
// end to end without a server.
export const UnitFixture = ({ state = 'mixed' }: UnitFixtureProps) => {
  const unit = unitsByState[state];
  const [entries, setEntries] = useState(entriesByState[state]);
  return (
    <PageLayout
      backControl={fixtureBackControl('English A2', 'course')}
      title={unit.name}
    >
      <p className="text-muted-foreground text-sm">
        {`${currentBook.name} · ${unitProgressSummary(unit, targetLabel)}`}
      </p>
      {unit.directions.length === 0 ? null : (
        <UnitDirectionPlan
          renderLearnAction={(progress, variant) =>
            fixtureControl(
              `${countNoun(itemsInNextSection(progress.unintroduced), 'Vokabel', 'Vokabeln')} kennenlernen${variant === 'primary' ? ` · ${directionLabel(progress.direction, targetLabel)}` : ''}`,
              'learn',
              variant,
            )
          }
          renderScheduledAction={(progress, variant) =>
            fixtureControl(
              `${countNoun(progress.due + progress.firstReviews, 'Karte', 'Karten')} üben · ${directionLabel(progress.direction, targetLabel)}`,
              'practice',
              variant,
            )
          }
          targetLabel={targetLabel}
          unit={unit}
        />
      )}
      <UnitVocabulary
        courseEntries={entries}
        createEntry={(draft) => {
          const added = {
            ...unitEntry(
              entries.length + 1,
              draft.targetText,
              draft.nativeText,
              false,
            ),
            unitId: unit.id,
            unitName: unit.name,
            example:
              draft.example === undefined
                ? null
                : {
                    targetText: draft.example.targetText,
                    nativeText: draft.example.nativeText ?? null,
                    source: draft.example.source,
                  },
          };
          setEntries((current) => [...current, added]);
          return Promise.resolve({
            entryId: added.id,
            audio: draft.targetText === 'silence' ? 'failed' : 'generated',
          } as const);
        }}
        enabledDirections={['to_target', 'to_native']}
        entries={entries}
        generateDraftExample={async (targetText) => ({
          target: `We packed our bags for the ${targetText}.`,
          native: 'Wir packten unsere Koffer für die Reise.',
        })}
        generateExample={async () => ({
          targetText: 'This is a useful example.',
          nativeText: 'Das ist ein hilfreiches Beispiel.',
          source: 'generated',
        })}
        importAction={fixtureControl(
          'Seite fotografieren',
          'import',
          'primary',
        )}
        renderStudyAction={(_, intent) => (
          <Button
            onClick={() =>
              navigateToFixture(
                intent === 'learn' ? 'learn-start' : 'study-start',
              )
            }
          >
            Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
          </Button>
        )}
        suggestTranslation={(text, given) =>
          Promise.resolve({
            translation: given === 'target' ? 'die Reise' : `the ${text}`,
          })
        }
        targetLabel={targetLabel}
        targetLanguage="en"
        translateDraftExample={async () => ({
          native: 'Wir packten unsere Koffer für die Reise.',
        })}
      />
    </PageLayout>
  );
};
