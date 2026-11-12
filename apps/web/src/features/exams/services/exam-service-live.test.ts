import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  dueEntryId,
  firstReviewEntryId,
  fixtureCourseId,
  fixtureUnitId,
  seedIntroducedCardFixture,
  unintroducedEntryId,
} from '../../../shared/testing/introduced-card-fixture';
import {
  ExamInputError,
  ExamNotFoundError,
  ExamStateError,
} from '../errors/exam-errors';
import { ExamService } from './exam-service';
import { ExamStore } from './exam-store';

const runExamTest = <A, E>(
  program: Effect.Effect<A, E, Database | ExamService>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.andThen(seedIntroducedCardFixture, program).pipe(
        Effect.provide(
          ExamService.layer.pipe(
            Layer.provide(ExamStore.live.pipe(Layer.provide(databaseLayer))),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

// The fixture's two introduced words, asked both ways: four learned cards.
const createLearnedExam = Effect.gen(function* () {
  const service = yield* ExamService;
  return yield* service.create({
    courseId: fixtureCourseId,
    name: 'Vokabeltest',
    directions: ['to_target', 'to_native'],
    entryIds: [dueEntryId, firstReviewEntryId],
  });
});

let answerCount = 0;

// Answers a card in a round as drill practice would, each answer later than
// the one before.
const answer = (
  roundId: string,
  entryId: string,
  direction: AnswerDirection,
  correct: boolean,
) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    answerCount += 1;
    const reviewedAt = new Date(Date.now() + answerCount * 1000);
    yield* sql`
      insert into reviews (
        card_id, reviewed_at, rating, mode, answer_text, exam_round_id
      )
      select id, ${reviewedAt}, ${correct ? ratings.good : ratings.again},
        'drill', 'Antwort', ${roundId}
      from cards where entry_id = ${entryId} and direction = ${direction}
    `;
  });

describe('ExamService', () => {
  it('counts the learned cards a round asks and the ones still to learn', async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const { examId } = yield* service.create({
          courseId: fixtureCourseId,
          name: 'Vokabeltest',
          directions: ['to_target', 'to_native'],
          entryIds: [dueEntryId, unintroducedEntryId, firstReviewEntryId],
        });
        const exam = yield* service.get(examId);
        expect(exam.entryCount).toBe(3);
        expect(exam.cards).toEqual({
          learned: 4,
          unlearned: 2,
          unlearnedEntryIds: [unintroducedEntryId],
        });
        expect(exam.openRound).toBeNull();
        expect(exam.readiness.lastRound).toBeNull();
      }),
    );
  });

  it('refuses a word that is not one of the course', async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const failure = yield* Effect.flip(
          service.create({
            courseId: fixtureCourseId,
            name: 'Vokabeltest',
            directions: ['to_target'],
            entryIds: [dueEntryId, 'ffffffff-ffff-4fff-8fff-ffffffffffff'],
          }),
        );
        expect(failure).toBeInstanceOf(ExamInputError);
      }),
    );
  });

  it("lists the words of the course's units and refuses a unit it lacks", async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const words = yield* service.unitEntryIds(fixtureCourseId, [
          fixtureUnitId,
        ]);
        expect(words.toSorted()).toEqual(
          [unintroducedEntryId, firstReviewEntryId, dueEntryId].toSorted(),
        );
        const failure = yield* Effect.flip(
          service.unitEntryIds('ffffffff-ffff-4fff-8fff-ffffffffffff', [
            fixtureUnitId,
          ]),
        );
        expect(failure).toBeInstanceOf(ExamNotFoundError);
      }),
    );
  });
});

describe('ExamService rounds', () => {
  it('scores the first answer per card and compares the two newest rounds', async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const { examId } = yield* createLearnedExam;
        const first = yield* service.startRound(examId);
        yield* answer(first.roundId, dueEntryId, 'to_target', false);
        yield* answer(first.roundId, dueEntryId, 'to_target', true);
        yield* answer(first.roundId, dueEntryId, 'to_native', true);
        yield* answer(first.roundId, firstReviewEntryId, 'to_target', true);
        yield* answer(first.roundId, firstReviewEntryId, 'to_native', false);
        const afterFirst = yield* service.get(examId);
        expect(afterFirst.openRound).toBeNull();
        expect(afterFirst.readiness.lastRound).toMatchObject({
          total: 4,
          correct: 2,
          completed: true,
        });
        expect(afterFirst.readiness.rightTwice).toBeNull();
        expect(afterFirst.readiness.missed).toHaveLength(2);

        const second = yield* service.startRound(examId);
        yield* answer(second.roundId, dueEntryId, 'to_target', true);
        yield* answer(second.roundId, dueEntryId, 'to_native', true);
        yield* answer(second.roundId, firstReviewEntryId, 'to_target', true);
        yield* answer(second.roundId, firstReviewEntryId, 'to_native', false);
        const { readiness } = yield* service.get(examId);
        expect(readiness.lastRound?.correct).toBe(3);
        expect(readiness.previousRound?.correct).toBe(2);
        // Right in both rounds: the due word's native card and the other
        // word's target card.
        expect(readiness.rightTwice).toBe(2);
        expect(
          readiness.missed.map((card) => [card.entryId, card.direction]),
        ).toEqual([[firstReviewEntryId, 'to_native']]);
      }),
    );
  });

  it('gives up an unfinished round when the next one starts', async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const { examId } = yield* createLearnedExam;
        const first = yield* service.startRound(examId);
        yield* answer(first.roundId, dueEntryId, 'to_target', true);
        const underway = yield* service.get(examId);
        expect(underway.openRound).toMatchObject({
          id: first.roundId,
          answered: 1,
          total: 4,
        });

        const second = yield* service.startRound(examId);
        const restarted = yield* service.get(examId);
        expect(restarted.openRound?.id).toBe(second.roundId);
        expect(restarted.rounds.map((round) => round.id)).toEqual([
          second.roundId,
          first.roundId,
        ]);
        expect(restarted.readiness.lastRound).toBeNull();
      }),
    );
  });

  it('keeps the cards a round asked when the test changes', async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const { examId } = yield* service.create({
          courseId: fixtureCourseId,
          name: 'Vokabeltest',
          directions: ['to_target', 'to_native'],
          entryIds: [dueEntryId],
        });
        const { roundId } = yield* service.startRound(examId);
        yield* service.update({
          examId,
          name: 'Vokabeltest',
          directions: ['to_target', 'to_native'],
          entryIds: [dueEntryId, firstReviewEntryId],
        });
        const exam = yield* service.get(examId);
        expect(exam.cards.learned).toBe(4);
        expect(exam.openRound).toMatchObject({ id: roundId, total: 2 });
      }),
    );
  });

  it('starts no round for an archived test or one with nothing learned', async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const { examId } = yield* createLearnedExam;
        yield* service.setArchived({ examId, archived: true });
        expect(yield* Effect.flip(service.startRound(examId))).toBeInstanceOf(
          ExamStateError,
        );

        const unlearned = yield* service.create({
          courseId: fixtureCourseId,
          name: 'Neue Wörter',
          directions: ['to_target'],
          entryIds: [unintroducedEntryId],
        });
        expect(
          yield* Effect.flip(service.startRound(unlearned.examId)),
        ).toBeInstanceOf(ExamStateError);
      }),
    );
  });
});
