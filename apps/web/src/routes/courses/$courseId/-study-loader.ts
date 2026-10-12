import { getCourseOutline } from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { getLearnSelection } from '../../../features/learning/services/server-fns';
import type { PracticeSession } from '../../../features/practice/schemas/practice-models';
import type { StudySearchData } from '../../../features/practice/schemas/session-request';
import { getStudySession } from '../../../features/practice/services/server-fns';
import {
  directionsWithCards,
  resolveAnswerDirection,
  resolveSessionDirection,
} from '../../../features/practice/services/session-options';
import type { VocabularySelectionData } from '../../../shared/session/vocabulary-selection';
import { courseSelection, findCoursePlace } from './-course-place';

const loadLearningMode = async (
  courseId: string,
  selection: VocabularySelectionData,
  deps: StudySearchData,
) => {
  const pass = await getLearnSelection({ data: { courseId, selection } });
  const availableDirections = pass.directions.map(
    (progress) => progress.direction,
  );
  const direction = resolveAnswerDirection(deps.direction, availableDirections);
  // Example sentences are prepared in the background once the pass is on
  // screen, as on the learn routes.
  return {
    availableDirections,
    direction,
    learningPass: pass,
    mode: 'learn' as const,
    preview: { items: [] },
    session: null,
    unlearned: 0,
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
  // Practice leaves out what has not been learned yet, so the start screen
  // says how much that is and offers learning it.
  const unlearned =
    session === null
      ? (
          await getLearnSelection({ data: { courseId, selection } })
        ).directions.reduce((sum, progress) => sum + progress.unintroduced, 0)
      : 0;
  return {
    availableDirections,
    direction,
    learningPass: null,
    mode: 'practice' as const,
    preview,
    session,
    unlearned,
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
      unlearned: 0,
    };
  }
  const mode =
    deps.mode === 'learn'
      ? await loadLearningMode(course.id, selection, deps)
      : await loadPracticeMode(course.id, selection, deps);
  return { ...mode, course, place, selection };
};
