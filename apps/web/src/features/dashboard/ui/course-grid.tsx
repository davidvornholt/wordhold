import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import type { CourseStats } from '../schemas/dashboard-models';
import { CourseCard } from './course-card';

type Course = {
  readonly id: string;
  readonly name: string;
  readonly targetLanguage: LanguageCode;
};

type CourseGridProps = {
  readonly courses: ReadonlyArray<Course>;
  readonly stats: ReadonlyArray<CourseStats>;
  readonly renderCourseLink: (course: Course) => ReactNode;
  readonly renderPracticeAction: (course: Course) => ReactNode;
  readonly renderLearnAction: (course: Course) => ReactNode;
  readonly renderImportAction: (course: Course) => ReactNode;
};

export const CourseGrid = ({
  courses,
  stats,
  renderCourseLink,
  renderPracticeAction,
  renderLearnAction,
  renderImportAction,
}: CourseGridProps) => (
  <section className="flex flex-col gap-4">
    <h2 className="font-display text-xl">Kurse</h2>
    <ul className="grid gap-4 sm:grid-cols-2">
      {courses.map((course) => (
        <CourseCard
          course={course}
          courseLink={renderCourseLink(course)}
          importAction={renderImportAction(course)}
          key={course.id}
          learnAction={renderLearnAction(course)}
          practiceAction={renderPracticeAction(course)}
          stats={stats.find((item) => item.courseId === course.id)}
        />
      ))}
    </ul>
  </section>
);
