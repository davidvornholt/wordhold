import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  listBibles,
  removeBible,
} from '../../../features/bibles/services/server-fns';
import { BibleLibrary } from '../../../features/bibles/ui/bible-library';
import { uploadBible } from '../../../features/bibles/ui/upload-bible';
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
  const { bibles, course, courses, directions } = Route.useLoaderData();
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
        <div className="flex flex-col gap-10">
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
          {course.kind === 'texts' ? (
            <BibleLibrary
              bibles={bibles}
              remove={async (bibleId) => {
                await removeBible({ data: { bibleId } });
                await router.invalidate();
              }}
              upload={async (file) => {
                const bible = await uploadBible(file);
                await router.invalidate();
                return bible;
              }}
            />
          ) : null}
        </div>
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
    const [course, courses, directions, bibles] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourses(),
      getCourseDirections({ data: params.courseId }),
      listBibles(),
    ]);
    return { bibles, course, courses, directions };
  },
  component: CourseSettingsScreen,
});
