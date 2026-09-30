type NamedCourse = { readonly id: string; readonly name: string };

// Names are compared regardless of case, as the server does, so two courses
// never read the same on the overview. A subject may change the casing of
// its own name.
export const courseNameTaken = (
  courses: ReadonlyArray<NamedCourse>,
  name: string,
  exceptCourseId?: string,
): string | null =>
  courses.some(
    (course) =>
      course.id !== exceptCourseId &&
      course.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  )
    ? `„${name}“ gibt es auf der Übersicht bereits.`
    : null;
