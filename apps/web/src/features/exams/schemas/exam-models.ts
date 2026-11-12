import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';

export const maximumExamNameLength = 80;
// Far more than one test covers; it bounds the request, not the learner.
export const maximumExamEntries = 2000;

// Named by the learner, such as "Vokabeltest Unit 3".
const ExamName = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumExamNameLength),
);

const ExamDirections = Schema.Array(Schema.Literals(answerDirections)).check(
  Schema.isMinLength(1),
  Schema.isUnique(),
);

const ExamEntryIds = Schema.Array(Uuid).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumExamEntries),
  Schema.isUnique(),
);

export const CreateExam = Schema.Struct({
  courseId: Uuid,
  name: ExamName,
  directions: ExamDirections,
  entryIds: ExamEntryIds,
});
export type CreateExamData = typeof CreateExam.Type;

// Replaces the test's name, directions and words. Rounds already run keep
// the cards they asked.
export const UpdateExam = Schema.Struct({
  examId: Uuid,
  name: ExamName,
  directions: ExamDirections,
  entryIds: ExamEntryIds,
});
export type UpdateExamData = typeof UpdateExam.Type;

export const SetExamArchived = Schema.Struct({
  examId: Uuid,
  archived: Schema.Boolean,
});
export type SetExamArchivedData = typeof SetExamArchived.Type;

const ExamRequest = Schema.Struct({ examId: Uuid });
const CourseExamsRequest = Schema.Struct({ courseId: Uuid });

export const decodeCreateExam = Schema.decodeUnknownSync(CreateExam);
export const decodeUpdateExam = Schema.decodeUnknownSync(UpdateExam);
export const decodeSetExamArchived = Schema.decodeUnknownSync(SetExamArchived);
export const decodeExamRequest = Schema.decodeUnknownSync(ExamRequest);
export const decodeCourseExamsRequest =
  Schema.decodeUnknownSync(CourseExamsRequest);

// A round's standing. Each card counts with its first answer in the round;
// a round is complete once every card has one.
export type RoundScore = {
  readonly id: string;
  readonly startedAt: Date;
  readonly total: number;
  readonly answered: number;
  readonly correct: number;
  readonly completed: boolean;
};

export type ExamSummary = {
  readonly id: string;
  readonly courseId: string;
  readonly name: string;
  readonly directions: ReadonlyArray<AnswerDirection>;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
  readonly entryCount: number;
  // The newest completed round, if any.
  readonly lastRound: RoundScore | null;
};

export type ExamEntry = {
  readonly id: string;
  readonly targetText: string;
  readonly nativeText: string;
};

// A card answered wrong first in the newest completed round.
export type MissedCard = {
  readonly cardId: string;
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly targetText: string;
  readonly nativeText: string;
};

// The numbers the learner judges their preparation by. Wordhold gives no
// verdict of its own.
export type ExamReadiness = {
  readonly lastRound: RoundScore | null;
  readonly previousRound: RoundScore | null;
  // Cards of the newest completed round answered right first in it and in
  // the completed round before; null until there are two.
  readonly rightTwice: number | null;
  readonly missed: ReadonlyArray<MissedCard>;
};

export type ExamDetail = Omit<ExamSummary, 'lastRound'> & {
  readonly entries: ReadonlyArray<ExamEntry>;
  // The test's cards in its directions as they stand now. Only learned
  // cards are asked; the others wait for the learning pass.
  readonly cards: {
    readonly learned: number;
    readonly unlearned: number;
    readonly unlearnedEntryIds: ReadonlyArray<string>;
  };
  // Newest first.
  readonly rounds: ReadonlyArray<RoundScore>;
  // The newest round, while it still has cards to answer. Older unfinished
  // rounds were given up when a newer one started.
  readonly openRound: RoundScore | null;
  readonly readiness: ExamReadiness;
};
