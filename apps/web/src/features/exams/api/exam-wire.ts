import type {
  ExamSummary as ApiExamSummary,
  Exam,
  ExamRound,
} from '@wordhold/api/exams';
import type {
  ExamDetail,
  ExamSummary,
  RoundScore,
} from '../schemas/exam-models';

const toApiRound = (round: RoundScore): ExamRound => ({
  id: round.id,
  startedAt: round.startedAt.toISOString(),
  total: round.total,
  answered: round.answered,
  correct: round.correct,
  completed: round.completed,
});

const toApiRoundOrNull = (round: RoundScore | null) =>
  round === null ? null : toApiRound(round);

const examFields = (exam: ExamSummary | ExamDetail) => ({
  id: exam.id,
  courseId: exam.courseId,
  name: exam.name,
  directions: exam.directions,
  createdAt: exam.createdAt.toISOString(),
  archivedAt: exam.archivedAt?.toISOString() ?? null,
  entryCount: exam.entryCount,
});

export const toApiExamSummary = (exam: ExamSummary): ApiExamSummary => ({
  ...examFields(exam),
  lastRound: toApiRoundOrNull(exam.lastRound),
});

/** A test as the CLI's API shows it. Card ids stay inside the app. */
export const toApiExam = (exam: ExamDetail): Exam => ({
  ...examFields(exam),
  entries: exam.entries.map((entry) => ({
    id: entry.id,
    targetText: entry.targetText,
    nativeText: entry.nativeText,
  })),
  cards: exam.cards,
  rounds: exam.rounds.map(toApiRound),
  openRound: toApiRoundOrNull(exam.openRound),
  readiness: {
    lastRound: toApiRoundOrNull(exam.readiness.lastRound),
    previousRound: toApiRoundOrNull(exam.readiness.previousRound),
    rightTwice: exam.readiness.rightTwice,
    missed: exam.readiness.missed.map((card) => ({
      entryId: card.entryId,
      direction: card.direction,
      targetText: card.targetText,
      nativeText: card.nativeText,
    })),
  },
});
