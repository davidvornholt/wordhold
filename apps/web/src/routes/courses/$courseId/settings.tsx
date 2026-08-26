import { createFileRoute, Link } from '@tanstack/react-router';
import {
  getCourseDirections,
  setCourseDirections,
} from '../../../features/courses/services/server-fns';
import { CourseSettingsLayout } from '../../../features/courses/ui/course-settings-layout';
import { DirectionSettings } from '../../../features/courses/ui/direction-settings';
import { getCourse } from '../../../features/import/server-fns';
import { germanLabels } from '../../../shared/languages';

const CourseSettingsScreen = () => {
  const { course, directions } = Route.useLoaderData();

  return (
    <CourseSettingsLayout
      backControl={
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      courseName={course.name}
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
    </CourseSettingsLayout>
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
