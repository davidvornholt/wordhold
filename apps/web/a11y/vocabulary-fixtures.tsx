import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { CourseLayout } from '../src/features/courses/ui/course-layout';
import { VocabularyLibrary } from '../src/features/courses/ui/vocabulary-library';
import { navigateToFixture } from './fixture-state';

const reviewedAt = '2026-08-28T10:00:00.000Z';

const entries: ReadonlyArray<VocabularyEntry> = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    unitId: '00000000-0000-0000-0000-000000000003',
    unitName: 'Unit 3: Holidays',
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    introduced: true,
    cards: [
      {
        cardId: '00000000-0000-0000-0000-000000000021',
        direction: 'to_target',
        state: 'review',
        dueAt: new Date('2026-08-28T10:00:00Z'),
        introducedAt: new Date('2026-08-20T10:00:00Z'),
        lastReviewedAt: new Date(reviewedAt),
        failures: 2,
        recentReviews: [{ reviewedAt, rating: 1 }],
      },
      {
        cardId: '00000000-0000-0000-0000-000000000022',
        direction: 'to_native',
        state: 'review',
        dueAt: new Date('2026-08-30T10:40:00Z'),
        introducedAt: new Date('2026-08-20T10:00:00Z'),
        lastReviewedAt: new Date(reviewedAt),
        failures: 0,
        recentReviews: [{ reviewedAt, rating: 3 }],
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    unitId: '00000000-0000-0000-0000-000000000004',
    unitName: 'Unit 4: Sport',
    targetText: 'the referee',
    nativeText: 'der Schiedsrichter',
    introduced: true,
    cards: [
      {
        cardId: '00000000-0000-0000-0000-000000000023',
        direction: 'to_target',
        state: 'new',
        dueAt: null,
        introducedAt: new Date('2026-08-29T08:00:00Z'),
        lastReviewedAt: null,
        failures: 0,
        recentReviews: [],
      },
      {
        cardId: '00000000-0000-0000-0000-000000000024',
        direction: 'to_native',
        state: 'new',
        dueAt: null,
        introducedAt: new Date('2026-08-29T08:00:00Z'),
        lastReviewedAt: null,
        failures: 0,
        recentReviews: [],
      },
    ],
  },
];

export const VocabularyFixture = ({
  difficult = false,
}: {
  readonly difficult?: boolean;
}) => (
  <CourseLayout
    backControl={
      <button onClick={() => navigateToFixture('course')} type="button">
        ← English A2
      </button>
    }
    title="English A2: Vokabelliste"
  >
    <p className="text-muted-foreground text-sm">
      Termine gelten pro Abfragerichtung. Wähle Vokabeln aus beliebigen Units.
    </p>
    <VocabularyLibrary
      entries={entries}
      initialFilter={difficult ? 'difficult' : 'all'}
      renderStudyAction={() => (
        <button
          className="min-h-11 bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => navigateToFixture('study-start')}
          type="button"
        >
          Frei üben
        </button>
      )}
      targetLanguage="en"
    />
  </CourseLayout>
);
