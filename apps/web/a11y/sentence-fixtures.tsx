import type {
  SentenceAnswerData,
  SentenceItem,
  SentenceResult,
} from '../src/features/practice/schemas/sentence-models';
import { SentenceRunner } from '../src/features/practice/ui/sentence-runner';
import type { PrepareExamples } from '../src/shared/examples/example-model';
import { normalizeAnswerForComparison } from '../src/shared/grading/normalize';
import { FocusLayout } from '../src/shared/ui/focus-layout';
import { mixedUnit } from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';

const item = (
  entryId: string,
  targetText: string,
  nativeText: string,
): SentenceItem => ({ entryId, targetText, nativeText, example: null });

const sister = item(
  '00000000-0000-0000-0000-000000000301',
  'sister',
  'Schwester',
);
const book = item('00000000-0000-0000-0000-000000000302', 'book', 'Buch');
// Its example has no German side, so the round leaves it out.
const memory = item(
  '00000000-0000-0000-0000-000000000303',
  'memory',
  'Erinnerung',
);

const examples = new Map([
  [
    sister.entryId,
    {
      targetText: 'My sister works in a hospital.',
      nativeText: 'Meine Schwester arbeitet in einem Krankenhaus.',
    },
  ],
  [
    book.entryId,
    {
      targetText: 'I am reading an exciting book.',
      nativeText: 'Ich lese gerade ein spannendes Buch.',
    },
  ],
  [
    memory.entryId,
    { targetText: 'This memory still makes me smile.', nativeText: null },
  ],
]);

const prepareExamples: PrepareExamples = ({ data }) =>
  Promise.resolve(
    data.flatMap((entryId) => {
      const example = examples.get(entryId);
      return example === undefined
        ? []
        : [
            {
              entryId,
              example: {
                ...example,
                source: 'generated' as const,
                hasAudio: false,
              },
            },
          ];
    }),
  );

const sameSentence = (left: string, right: string) =>
  normalizeAnswerForComparison(left) === normalizeAnswerForComparison(right);

// The judge as the flow test needs it: a misspelling is corrected, and a
// contraction of the stored translation is accepted.
const checkSentence = ({
  data,
}: {
  readonly data: SentenceAnswerData;
}): Promise<SentenceResult> => {
  const reference = examples.get(data.entryId)?.targetText ?? '';
  if (data.answer.includes('hospitel')) {
    return Promise.resolve({
      graded: true,
      correct: false,
      reference,
      correction: data.answer.replace('hospitel', 'hospital'),
      explanation: "'hospitel' schreibt man 'hospital'.",
    });
  }
  const contracted = reference.replace('I am', "I'm");
  const correct =
    sameSentence(data.answer, reference) ||
    sameSentence(data.answer, contracted);
  return Promise.resolve({
    graded: true,
    correct,
    reference,
    correction: null,
    explanation: correct ? null : 'Der Satz sagt etwas anderes.',
  });
};

export const SentencePracticeFixture = () => (
  <FocusLayout
    exit={fixtureBackControl(mixedUnit.name, 'unit')}
    title={`${mixedUnit.name} · Sätze übersetzen`}
  >
    <SentenceRunner
      backControl={fixtureControl(
        `Zurück zu ${mixedUnit.name}`,
        'unit',
        'quiet-muted',
      )}
      check={checkSentence}
      continueControl={fixtureControl(
        'Noch eine Runde',
        'sentence-practice',
        'primary',
      )}
      prepareExamples={prepareExamples}
      session={{ items: [sister, memory, book] }}
      targetLanguage="en"
    />
  </FocusLayout>
);
