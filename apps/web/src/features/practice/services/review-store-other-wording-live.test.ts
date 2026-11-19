import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  dueEntryId,
  fixtureCourseId,
  fixtureOwnerId,
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeReviewStore } from './review-store';
import {
  makeReviewInput,
  runReviewTest,
} from './review-store-live-test-support';

const otherCourseId = '0c0c0c0c-0c0c-40c0-80c0-0c0c0c0c0c0c';
const missingExamId = '0f0f0f0f-0f0f-40f0-80f0-0f0f0f0f0f0f';

const passing = { ok: true, note: null } as const;

const otherWording: JudgeVerdictData = {
  correct: false,
  acceptAsAlternative: false,
  otherWording: true,
  meaning: passing,
  grammar: passing,
  idiomaticity: passing,
  spelling: passing,
  intendedConstruction: { ok: false, note: 'Im Buch steht ein anderes Wort.' },
  explanation: "Gesucht ist 'souvenir'.",
};

const insertExam = (courseId: string) =>
  Effect.flatMap(Database, (sql) =>
    sql<{ readonly id: string }>`
      insert into exams (course_id, name, directions)
      values (${courseId}, 'Vokabeltest', '{to_target}')
      returning id
    `.pipe(
      Effect.flatMap((rows) => {
        const id = rows.at(0)?.id;
        return id === undefined
          ? Effect.die('Expected the inserted test.')
          : Effect.succeed(id);
      }),
    ),
  );

describe('PracticeReviewStore answer in other wording', () => {
  it('tells a test of the card course from any other test id', async () => {
    const found = await runReviewTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* PracticeReviewStore;
        yield* sql`
          insert into courses (id, owner_id, name, target_language)
          values (${otherCourseId}, ${fixtureOwnerId}, 'Spanish', 'es')
        `;
        const courseExam = yield* insertExam(fixtureCourseId);
        const otherExam = yield* insertExam(otherCourseId);
        const { card } = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_target',
          answer: 'mémoire',
        });
        const inCourse = (examId: string | null) =>
          store
            .findSubmission(card.id, card.revision, examId)
            .pipe(Effect.map((row) => row?.examInCourse));
        return {
          courseExam: yield* inCourse(courseExam),
          otherExam: yield* inCourse(otherExam),
          missingExam: yield* inCourse(missingExamId),
          none: yield* inCourse(null),
        };
      }),
    );
    expect(found).toEqual({
      courseExam: true,
      otherExam: false,
      missingExam: false,
      none: false,
    });
  });

  it('records the wording without storing it as an accepted answer', async () => {
    const stored = await runReviewTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* PracticeReviewStore;
        const input = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_target',
          answer: 'mémoire',
        });
        const persisted = yield* store.commit({
          ...input,
          rating: ratings.hard,
          outcome: { method: 'other-wording', verdict: otherWording },
        });
        const reviews = yield* sql<{
          readonly rating: number;
          readonly method: string;
        }>`
          select rating, grading->>'method' as method from reviews
          where card_id = ${input.card.id}
        `;
        const [answers] = yield* sql<{ readonly count: number }>`
          select count(*)::int as count from accepted_answers
          where entry_id = ${dueEntryId} and normalized = 'mémoire'
        `;
        return {
          alternativeStored: persisted.alternativeStored,
          reviews,
          answers: answers?.count,
        };
      }),
    );
    expect(stored).toEqual({
      alternativeStored: false,
      reviews: [{ rating: ratings.hard, method: 'other-wording' }],
      answers: 0,
    });
  });
});
