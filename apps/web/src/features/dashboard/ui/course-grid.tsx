import type { ReactNode } from 'react';
import type { CourseSubject, ListCourseKind } from '../../../shared/directions';
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
  // language, typing a term or text for a subject or collection.
  readonly renderStartAction: (course: Course) => ReactNode;
  // Adds a subject or collection; languages come with the app.
  readonly renderNewSubjectAction: (kind: ListCourseKind) => ReactNode;
};

type CourseListProps = Omit<CourseGridProps, 'renderNewSubjectAction'>;

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

// Subjects and collections are sections of their own, each with a short
// explanation while it is still empty.
const listSections = [
  {
    kind: 'terms',
    heading: 'Fächer',
    intro:
      'In einem Fach lernst du Fachbegriffe mit ihrer Definition, zum Beispiel für Chemie oder Biologie.',
  },
  {
    kind: 'texts',
    heading: 'Sammlungen',
    intro:
      'In einer Sammlung lernst du Texte wortwörtlich auswendig, zum Beispiel Bibelverse oder Gedichte.',
  },
] as const satisfies ReadonlyArray<{
  readonly kind: ListCourseKind;
  readonly heading: string;
  readonly intro: string;
}>;

export const CourseGrid = ({
  courses,
  renderNewSubjectAction,
  ...list
}: CourseGridProps) => {
  const languages = courses.filter((course) => course.kind === 'language');
  return (
    <>
      {languages.length === 0 ? null : (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl">Sprachen</h2>
          <CourseList courses={languages} {...list} />
        </section>
      )}
      {listSections.map(({ kind, heading, intro }) => {
        const listed = courses.filter((course) => course.kind === kind);
        return (
          <section className="flex flex-col gap-4" key={kind}>
            <h2 className="font-display text-xl">{heading}</h2>
            {listed.length === 0 ? (
              <p className="text-muted-foreground text-sm">{intro}</p>
            ) : (
              <CourseList courses={listed} {...list} />
            )}
            <div>{renderNewSubjectAction(kind)}</div>
          </section>
        );
      })}
    </>
  );
};
