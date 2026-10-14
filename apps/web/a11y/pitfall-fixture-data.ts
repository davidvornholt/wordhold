import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { LearnItem } from '../src/features/learning/schemas/learning-models';
import type { PracticeItem } from '../src/features/practice/schemas/practice-models';
import type { PreparePitfalls } from '../src/shared/pitfalls/pitfall-model';

// A word with one spot learners often misspell, shown with pitfalls=true.
const entryId = '00000000-0000-0000-0000-000000000071';

export const adolescentPitfall: SpellingPitfall = {
  segments: [
    { text: 'adole', tricky: false },
    { text: 'sc', tricky: true },
    { text: 'ent', tricky: false },
  ],
  note: 'Das c hört man nicht, wie in adolescence.',
};

// Met for the first time, so its pitfall is still to be prepared.
export const adolescentLearnItem: LearnItem = {
  cardId: '00000000-0000-0000-0000-000000000072',
  direction: 'to_target',
  entryId,
  targetText: 'adolescent',
  nativeText: 'der/die Jugendliche',
  hasAudio: false,
  example: null,
  textbookAnswers: ['adolescent'],
  keyPoints: null,
  spellingPitfalls: null,
};

export const adolescentPracticeItem: PracticeItem = {
  cardId: adolescentLearnItem.cardId,
  revision: 0,
  direction: 'to_target',
  entryId,
  targetText: 'adolescent',
  nativeText: 'der/die Jugendliche',
  relatedWords: [],
  hasAudio: false,
  entryKnown: false,
  example: null,
  prompt: 'der/die Jugendliche',
  spellingPitfalls: [adolescentPitfall],
};

export const prepareAdolescentPitfalls: PreparePitfalls = ({ data }) =>
  Promise.resolve(
    data.map((id) => ({
      entryId: id,
      pitfalls: id === entryId ? [adolescentPitfall] : [],
    })),
  );

export const pitfallsRequested = (): boolean =>
  new URLSearchParams(globalThis.location.search).get('pitfalls') === 'true';
