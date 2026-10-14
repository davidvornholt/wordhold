import { Schema } from 'effect';
import { maximumEntryTextLength } from '../extraction/schema';

// The one place a word is most often misspelled; more marks dilute it.
export const maximumPitfallsPerWord = 1;
// Words per request: enough for a learning section, small enough that a slow
// or failed request costs little.
export const maximumPitfallBatch = 20;
const maximumNoteLength = 160;

// Empty fields pass here and drop only their pitfall when read: the model
// sometimes fills a pitfall with nothing instead of leaving it out, and that
// should not cost the other words of the batch.
const PitfallText = Schema.Trim.check(
  Schema.isMaxLength(maximumEntryTextLength),
);

// Naming a concrete misspelling keeps the model to mistakes students make,
// and comparing it with the word places the mark.
const Pitfall = Schema.Struct({
  word: PitfallText,
  letters: Schema.Array(PitfallText),
  misspelling: PitfallText,
  note: Schema.Trim.check(Schema.isMaxLength(maximumNoteLength)),
});
export type PitfallSuggestion = typeof Pitfall.Type;

// One entry per requested word, in the order the words were asked.
export const PitfallSuggestions = Schema.Struct({
  words: Schema.Array(
    Schema.Struct({
      pitfalls: Schema.Array(Pitfall).check(
        Schema.isMaxLength(maximumPitfallsPerWord),
      ),
    }),
  ),
});
export type PitfallSuggestionsData = typeof PitfallSuggestions.Type;

export type SpellingSegment = {
  readonly text: string;
  readonly tricky: boolean;
};

// One word of a vocabulary item split into plain and tricky letters, with a
// German note on why it is written that way. The misspelling itself is never
// shown, so the learner sees only the correct form.
export type SpellingPitfall = {
  readonly segments: ReadonlyArray<SpellingSegment>;
  readonly note: string;
};

export type PitfallWord = {
  readonly targetText: string;
  readonly nativeText: string;
};

export type PitfallRequest = {
  readonly targetLanguage: string;
  readonly words: ReadonlyArray<PitfallWord>;
};
