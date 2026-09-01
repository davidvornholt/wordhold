import {
  listCourseUnits,
  prepareVocabularyExamples,
} from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { getLearnSelection } from '../../../features/learning/services/server-fns';
import type { PracticeSession } from '../../../features/practice/schemas/practice-models';
import {
  type StudySearchData,
  selectedEntryIds,
} from '../../../features/practice/schemas/session-request';
import { getStudySession } from '../../../features/practice/services/server-fns';
import {
  directionsWithCards,
  resolveAnswerDirection,
  resolveSessionDirection,
} from '../../../features/practice/services/session-options';
import {
  attachPreparedExamples,
  prepareItemExamples,
} from '../../../shared/examples/example-model';
import type { VocabularySelectionData } from '../../../shared/session/vocabulary-selection';

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
  const prepared =
    direction === undefined
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
  const preview = await getStudySession({
    data: { courseId, direction: 'both', selection },
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
      data: { courseId, direction, selection },
    });
  }
  if (session !== null) {
    session = {
      ...session,
      items: await prepareItemExamples(
        session.items,
        prepareVocabularyExamples,
      ),
    };
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
  const [course, units] = await Promise.all([
    getCourse({ data: courseId }),
    listCourseUnits({ data: courseId }),
  ]);
  const unit = units.find((candidate) => candidate.id === deps.unit);
  const entryIds = selectedEntryIds(deps.entries);
  let selection: VocabularySelectionData | null = null;
  if (unit !== undefined) {
    selection = { unitId: unit.id };
  } else if (entryIds.length > 0) {
    selection = {
      entryIds: [entryIds[0] as string, ...entryIds.slice(1)],
    };
  }
  if (selection === null) {
    return {
      availableDirections: [],
      course,
      direction: undefined,
      learningPass: null,
      mode: 'practice' as const,
      preview: { items: [] },
      selection,
      session: null,
      unit,
    };
  }
  const mode =
    deps.mode === 'learn'
      ? await loadLearningMode(course.id, selection, deps)
      : await loadPracticeMode(course.id, selection, deps);
  return { ...mode, course, selection, unit };
};
