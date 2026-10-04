import {
  getCourseOutline,
  prepareVocabularyExamples,
} from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import type { Course } from '../../../features/import/services/repository';
import { getLearnSelection } from '../../../features/learning/services/server-fns';
import type { PracticeSession } from '../../../features/practice/schemas/practice-models';
import type { StudySearchData } from '../../../features/practice/schemas/session-request';
import { getStudySession } from '../../../features/practice/services/server-fns';
import {
  directionsWithCards,
  resolveAnswerDirection,
  resolveSessionDirection,
} from '../../../features/practice/services/session-options';
import { attachPreparedExamples } from '../../../shared/examples/example-model';
import type { VocabularySelectionData } from '../../../shared/session/vocabulary-selection';
import { courseSelection, findCoursePlace } from './-course-place';

const loadLearningMode = async (
  course: Course,
  selection: VocabularySelectionData,
  deps: StudySearchData,
) => {
  const pass = await getLearnSelection({
    data: { courseId: course.id, selection },
  });
  const availableDirections = pass.directions.map(
    (progress) => progress.direction,
  );
  const direction = resolveAnswerDirection(deps.direction, availableDirections);
  // A definition has no example sentence to show.
  const prepared =
    direction === undefined || course.kind === 'terms'
      ? []
      : await prepareVocabularyExamples({
          data: pass.items
            .filter((item) => item.direction === direction)
            .map((item) => item.entryId),
        });
  return {
    availableDirections,
    direction,
    learningPass: {
      ...pass,
      items: attachPreparedExamples(pass.items, prepared),
    },
    mode: 'learn' as const,
    preview: { items: [] },
    session: null,
  };
};

const loadPracticeMode = async (
  courseId: string,
  selection: VocabularySelectionData,
  deps: StudySearchData,
) => {
  // The Wackelkandidaten failed in the directions the course still practises.
  // With one of those left, their sitting starts without asking.
  const includeSwitchedOff = deps.from !== 'fragile';
  const preview = await getStudySession({
    data: { courseId, direction: 'both', selection, includeSwitchedOff },
  });
  const availableDirections = directionsWithCards(preview.items);
  const direction = resolveSessionDirection(
    deps.direction,
    availableDirections,
    availableDirections,
  );
  let session: PracticeSession | null = null;
  if (direction === 'both') {
    session = preview;
  } else if (direction !== undefined) {
    session = await getStudySession({
      data: { courseId, direction, selection, includeSwitchedOff },
    });
  }
  return {
    availableDirections,
    direction,
    learningPass: null,
    mode: 'practice' as const,
    preview,
    session,
  };
};

export const loadStudyData = async (
  courseId: string,
  deps: StudySearchData,
) => {
  const [course, outline] = await Promise.all([
    getCourse({ data: courseId }),
    getCourseOutline({ data: courseId }),
  ]);
  const place = findCoursePlace(outline, deps);
  const selection = courseSelection(place, deps.entries);
  if (selection === null) {
    return {
      availableDirections: [],
      course,
      direction: undefined,
      learningPass: null,
      mode: 'practice' as const,
      preview: { items: [] },
      place,
      selection,
      session: null,
    };
  }
  const mode =
    deps.mode === 'learn'
      ? await loadLearningMode(course, selection, deps)
      : await loadPracticeMode(course.id, selection, deps);
  return { ...mode, course, place, selection };
};
