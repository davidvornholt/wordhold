import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import type { DirectionStats } from '../schemas/dashboard-models';
import { CourseCard } from './course-card';

type Course = {
  readonly id: string;
  readonly name: string;
  readonly targetLanguage: LanguageCode;
};

type CourseStats = {
  readonly courseId: string;
  readonly due: number;
  readonly firstReviews: number;
  readonly ready: number;
  readonly unintroduced: number;
  readonly entries: number;
  readonly nextDueAt: Date | null;
  readonly directions: ReadonlyArray<DirectionStats>;
};

type CourseGridProps = {
  readonly courses: ReadonlyArray<Course>;
  readonly stats: ReadonlyArray<CourseStats>;
  readonly reviewsToday: number;
  readonly cardsToday: number;
  readonly renderCourseLink: (course: Course) => ReactNode;
  readonly renderPracticeAction: (course: Course) => ReactNode;
  readonly renderImportAction: (course: Course) => ReactNode;
};

export const CourseGrid = ({
  courses,
  stats,
  reviewsToday,
  cardsToday,
  renderCourseLink,
  renderPracticeAction,
  renderImportAction,
}: CourseGridProps) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-baseline justify-between">
      <h2 className="font-display text-xl">Kurse</h2>
      <p className="text-muted-foreground text-sm">
        {reviewsToday > 0
          ? `Heute ${countNoun(cardsToday, 'Karte', 'Karten')} · ${countNoun(
              reviewsToday,
              'Antwort',
              'Antworten',
            )}`
          : 'Heute noch nichts geübt'}
      </p>
    </div>
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard
          course={course}
          courseLink={renderCourseLink(course)}
          importAction={renderImportAction(course)}
          key={course.id}
          practiceAction={renderPracticeAction(course)}
          stats={stats.find((item) => item.courseId === course.id)}
        />
      ))}
    </ul>
  </section>
);
