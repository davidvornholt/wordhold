import { createFileRoute } from '@tanstack/react-router';
import {
  getCourseDirections,
  setCourseDirections,
} from '../../../features/courses/services/server-fns';
import { DirectionSettings } from '../../../features/courses/ui/direction-settings';
import { getCourse } from '../../../features/import/server-fns';
import { germanLabels } from '../../../shared/languages';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';

const CourseSettingsScreen = () => {
  const { course, directions } = Route.useLoaderData();

  return (
    <PageLayout
      backControl={
        <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
          {course.name}
        </BackLink>
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
    </PageLayout>
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
