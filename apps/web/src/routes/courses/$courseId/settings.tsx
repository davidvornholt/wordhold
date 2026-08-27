import { createFileRoute, Link } from '@tanstack/react-router';
import {
  getCourseDirections,
  setCourseDirections,
} from '../../../features/courses/services/server-fns';
import { CourseLayout } from '../../../features/courses/ui/course-layout';
import { DirectionSettings } from '../../../features/courses/ui/direction-settings';
import { getCourse } from '../../../features/import/server-fns';
import { germanLabels } from '../../../shared/languages';

const CourseSettingsScreen = () => {
  const { course, directions } = Route.useLoaderData();

  return (
    <CourseLayout
      backControl={
        <Link
          className="text-muted-foreground text-sm underline"
          params={{ courseId: course.id }}
          to="/courses/$courseId"
        >
          ← {course.name}
        </Link>
      }
      title={`${course.name}: Einstellungen`}
    >
      <DirectionSettings
        initial={directions}
        save={(next) =>
          setCourseDirections({
            data: { courseId: course.id, directions: next },
          })
        }
        targetLabel={germanLabels[course.targetLanguage]}
      />
    </CourseLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/settings')({
  loader: async ({ params }) => {
    const [course, directions] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
    ]);
    return { course, directions };
  },
  component: CourseSettingsScreen,
});
