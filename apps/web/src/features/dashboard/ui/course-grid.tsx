import type { ReactNode } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import type { CourseStats } from '../schemas/dashboard-models';
import { CourseCard } from './course-card';

type Course = CourseSubject & {
  readonly id: string;
  readonly name: string;
};

type CourseGridProps = {
  readonly courses: ReadonlyArray<Course>;
  readonly stats: ReadonlyArray<CourseStats>;
  readonly renderCourseLink: (course: Course) => ReactNode;
  readonly renderPracticeAction: (course: Course) => ReactNode;
  readonly renderLearnAction: (course: Course) => ReactNode;
  // What an empty course offers first: photographing a page for a
  // language, typing a term for a subject.
  readonly renderStartAction: (course: Course) => ReactNode;
  // Adds a subject; languages come with the app.
  readonly subjectForm: ReactNode;
};

type CourseListProps = Omit<CourseGridProps, 'subjectForm'>;

const CourseList = ({
  courses,
  stats,
  renderCourseLink,
  renderPracticeAction,
  renderLearnAction,
  renderStartAction,
}: CourseListProps) => (
  <ul className="grid gap-4 sm:grid-cols-2">
    {courses.map((course) => (
      <CourseCard
        course={course}
        courseLink={renderCourseLink(course)}
        key={course.id}
        learnAction={renderLearnAction(course)}
        practiceAction={renderPracticeAction(course)}
        startAction={renderStartAction(course)}
        stats={stats.find((item) => item.courseId === course.id)}
      />
    ))}
  </ul>
);

export const CourseGrid = ({
  courses,
  subjectForm,
  ...list
}: CourseGridProps) => {
  const languages = courses.filter((course) => course.kind === 'language');
  const subjects = courses.filter((course) => course.kind === 'terms');
  return (
    <>
      {languages.length === 0 ? null : (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl">Sprachen</h2>
          <CourseList courses={languages} {...list} />
        </section>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl">Fächer</h2>
        {subjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            In einem Fach lernst du Fachbegriffe mit ihrer Definition, zum
            Beispiel für Chemie oder Biologie.
          </p>
        ) : (
          <CourseList courses={subjects} {...list} />
        )}
        {subjectForm}
      </section>
    </>
  );
};
