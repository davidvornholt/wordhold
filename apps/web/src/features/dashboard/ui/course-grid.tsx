import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import { CourseCard } from './course-card';

type Course = {
  readonly id: string;
  readonly name: string;
  readonly targetLanguage: LanguageCode;
};

type CourseStats = {
  readonly courseId: string;
  readonly due: number;
  readonly fresh: number;
  readonly unlearned: number;
  readonly words: number;
};

type CourseGridProps = {
  readonly courses: ReadonlyArray<Course>;
  readonly stats: ReadonlyArray<CourseStats>;
  readonly reviewsToday: number;
  readonly renderPracticeAction: (course: Course) => ReactNode;
  readonly renderLearnAction: (course: Course) => ReactNode;
  readonly renderDrillAction: (course: Course) => ReactNode;
  readonly renderImportAction: (course: Course) => ReactNode;
  readonly renderSettingsAction: (course: Course) => ReactNode;
};

export const CourseGrid = ({
  courses,
  stats,
  reviewsToday,
  renderPracticeAction,
  renderLearnAction,
  renderDrillAction,
  renderImportAction,
  renderSettingsAction,
}: CourseGridProps) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-baseline justify-between">
      <h2 className="font-display text-xl">Kurse</h2>
      {reviewsToday > 0 ? (
        <p className="text-muted-foreground text-sm">
          Heute {reviewsToday} Antworten geübt.
        </p>
      ) : null}
    </div>
    <ul className="grid gap-3 sm:grid-cols-3">
      {courses.map((course) => (
        <CourseCard
          course={course}
          drillAction={renderDrillAction(course)}
          importAction={renderImportAction(course)}
          key={course.id}
          learnAction={renderLearnAction(course)}
          practiceAction={renderPracticeAction(course)}
          settingsAction={renderSettingsAction(course)}
          stats={stats.find((item) => item.courseId === course.id)}
        />
      ))}
    </ul>
  </section>
);
