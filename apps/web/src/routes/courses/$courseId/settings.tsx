import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  getCourseDirections,
  renameSubject,
  setCourseDirections,
} from '../../../features/courses/services/server-fns';
import { DirectionSettings } from '../../../features/courses/ui/direction-settings';
import { SubjectSettings } from '../../../features/courses/ui/subject-settings';
import { getCourse, listCourses } from '../../../features/import/server-fns';
import { isListCourse } from '../../../shared/directions';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';

const CourseSettingsScreen = () => {
  const { course, courses, directions } = Route.useLoaderData();
  const router = useRouter();

  return (
    <PageLayout
      backControl={
        <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
          {course.name}
        </BackLink>
      }
      title={`${course.name}: Einstellungen`}
    >
      {isListCourse(course.kind) ? (
        <SubjectSettings
          courseId={course.id}
          courses={courses}
          kind={course.kind}
          name={course.name}
          rename={async (name) => {
            await renameSubject({ data: { courseId: course.id, name } });
            await router.invalidate();
          }}
        />
      ) : (
        <DirectionSettings
          initial={directions}
          save={(next) =>
            setCourseDirections({
              data: { courseId: course.id, directions: next },
            })
          }
          subject={course}
        />
      )}
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/settings')({
  loader: async ({ params }) => {
    const [course, courses, directions] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourses(),
      getCourseDirections({ data: params.courseId }),
    ]);
    return { course, courses, directions };
  },
  component: CourseSettingsScreen,
});
