import { HomeShell } from '../src/app/home-shell';
import { CourseGrid } from '../src/features/dashboard/ui/course-grid';
import { FragileList } from '../src/features/dashboard/ui/fragile-list';
import { PendingPages } from '../src/features/import/ui/pending-pages';
import { navigateToFixture } from './fixture-state';

const course = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'English A2',
  targetLanguage: 'en' as const,
};
const fixtureReviewsToday = 7;
const fixtureDue = 4;
const fixtureFresh = 2;
const fixtureWords = 18;

const navigation = (
  <>
    <a className="text-neutral-400 text-xs underline" href="/bake/heirloom">
      Bake-off: Heirloom
    </a>
    <a className="text-neutral-400 text-xs underline" href="/bake/warm-print">
      Bake-off: Warm Print
    </a>
  </>
);

const action = (label: string, destination: 'import' | 'practice') => (
  <button
    className="text-sm underline"
    onClick={() => navigateToFixture(destination)}
    type="button"
  >
    {label}
  </button>
);

export const SignedOutFixture = () => (
  <HomeShell
    navigation={navigation}
    onSignIn={() => navigateToFixture('dashboard')}
    onSignOut={() => undefined}
    signedIn={false}
  >
    {null}
  </HomeShell>
);

export const DashboardFixture = ({ empty = false }) => (
  <HomeShell
    navigation={navigation}
    onSignIn={() => undefined}
    onSignOut={() => navigateToFixture('signed-out')}
    signedIn={true}
  >
    <CourseGrid
      courses={[course]}
      renderImportAction={() => action('Seite fotografieren', 'import')}
      renderPracticeAction={() => action('Üben', 'practice')}
      reviewsToday={empty ? 0 : fixtureReviewsToday}
      stats={[
        {
          courseId: course.id,
          due: empty ? 0 : fixtureDue,
          fresh: empty ? 0 : fixtureFresh,
          words: empty ? 0 : fixtureWords,
        },
      ]}
    />
    <FragileList
      words={
        empty
          ? []
          : [
              {
                entryId: '00000000-0000-0000-0000-000000000002',
                targetText: 'memory',
                nativeText: 'Erinnerung',
                courseName: 'English A2',
                failures: 2,
              },
            ]
      }
    />
    <PendingPages pages={[]} renderPageAction={() => null} />
  </HomeShell>
);
