import { countNoun } from '../../../shared/format/count';
import {
  type CourseSummary,
  type DashboardData,
  totalReady,
} from '../schemas/dashboard-models';
import { CourseCard } from './course-card';
import { FragileList } from './fragile-list';
import { WeekStrip } from './week-strip';

type ProgressOverviewProps = {
  readonly name: string;
  readonly courses: ReadonlyArray<CourseSummary>;
  readonly dashboard: DashboardData;
};

const todayLine = (dashboard: DashboardData): string =>
  dashboard.reviewsToday === 0
    ? 'Heute noch nicht geübt'
    : `Heute ${countNoun(dashboard.cardsToday, 'Karte', 'Karten')} geübt, ${countNoun(
        dashboard.reviewsToday,
        'Antwort',
        'Antworten',
      )}`;

type CourseSectionProps = {
  readonly title: string;
  readonly courses: ReadonlyArray<CourseSummary>;
  readonly dashboard: DashboardData;
};

const CourseSection = ({ title, courses, dashboard }: CourseSectionProps) =>
  courses.length === 0 ? null : (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {courses.map((course) => (
          <CourseCard
            course={course}
            courseLink={<h3 className="font-display text-xl">{course.name}</h3>}
            key={course.id}
            learnAction={null}
            practiceAction={null}
            startAction={null}
            stats={dashboard.perCourse.find(
              (stats) => stats.courseId === course.id,
            )}
          />
        ))}
      </ul>
    </section>
  );

// The administrator's read-only view of another person: the numbers from
// that person's overview, without anything that starts or changes practice.
export const ProgressOverview = ({
  name,
  courses,
  dashboard,
}: ProgressOverviewProps) => (
  <div className="flex flex-col gap-10">
    <section className="grid gap-6 border-border border-b pb-8 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl">Heute</h2>
        <p>
          {countNoun(totalReady(dashboard.perCourse), 'Karte', 'Karten')} bereit
        </p>
        <p className="text-muted-foreground text-sm">{todayLine(dashboard)}</p>
      </div>
      <WeekStrip streak={dashboard.streak} week={dashboard.week} />
    </section>
    {courses.length === 0 ? (
      <p className="text-muted-foreground">
        {name} hat noch keine Sprachen oder Fächer. Sie erscheinen nach der
        ersten Anmeldung.
      </p>
    ) : (
      <>
        <CourseSection
          courses={courses.filter((course) => course.kind === 'language')}
          dashboard={dashboard}
          title="Sprachen"
        />
        <CourseSection
          courses={courses.filter((course) => course.kind === 'terms')}
          dashboard={dashboard}
          title="Fächer"
        />
      </>
    )}
    <FragileList entries={dashboard.fragile} renderPracticeAction={null} />
  </div>
);
