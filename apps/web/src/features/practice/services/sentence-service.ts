import { isSentenceCorrect } from '@wordhold/ai/sentence/judge-schema';
import { Effect } from 'effect';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import { englishNames } from '../../../shared/languages';
import { StaleSentenceError } from '../errors/practice-errors';
import type {
  SentenceAnswerData,
  SentenceResult,
  SentenceSession,
  SentenceSessionRequestData,
} from '../schemas/sentence-models';
import { SentenceGrader } from './sentence-grader';
import { SentenceStore } from './sentence-store';

// Sentence practice is extra practice: nothing here writes a review or moves
// a card, so the schedule is the same before and after a sitting.
export class SentenceService extends Effect.Service<SentenceService>()(
  'wordhold/SentenceService',
  {
    effect: Effect.gen(function* () {
      const store = yield* SentenceStore;
      const grader = yield* SentenceGrader;

      const getSession = ({ courseId, place }: SentenceSessionRequestData) =>
        Effect.map(
          store.loadSession(courseId, place),
          (items): SentenceSession => ({
            items: items.map((item) => ({ ...item, example: null })),
          }),
        );

      const check = ({ entryId, sentence, answer }: SentenceAnswerData) =>
        Effect.gen(function* () {
          const target = yield* store.readTarget(entryId);
          if (target === undefined || target.sentence !== sentence) {
            return yield* new StaleSentenceError({
              message:
                'Dieser Beispielsatz wurde inzwischen geändert. Lade die Übung neu.',
            });
          }
          const { reference } = target;
          // The stored translation itself needs no judge.
          if (
            normalizeAnswerForComparison(answer) ===
            normalizeAnswerForComparison(reference)
          ) {
            return {
              graded: true,
              correct: true,
              reference,
              correction: null,
              explanation: null,
            } satisfies SentenceResult;
          }
          return yield* grader
            .judge({
              targetLanguage: englishNames[target.targetLanguage],
              sentence,
              reference,
              word: target.word,
              givenAnswer: answer,
            })
            .pipe(
              Effect.map((verdict): SentenceResult => {
                const correct = isSentenceCorrect(verdict);
                return {
                  graded: true,
                  correct,
                  reference,
                  correction: correct ? null : verdict.correction,
                  explanation: correct ? null : verdict.explanation,
                };
              }),
              Effect.catchTag('PracticeJudgeError', () =>
                Effect.succeed<SentenceResult>({
                  graded: false,
                  reference,
                  message:
                    'Der KI-Prüfer ist gerade nicht erreichbar; die Antwort wurde nicht gewertet.',
                }),
              ),
            );
        });

      return { getSession, check } as const;
    }),
  },
) {}
