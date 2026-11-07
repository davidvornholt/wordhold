import type { AiCall, AiCallUsage } from '@wordhold/ai/usage';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { Progress } from './sample-histories';

export type SampleWord = {
  readonly target: string;
  readonly native: string;
  readonly progress: Progress;
  readonly example?: { readonly target: string; readonly native: string };
  // Settled synonym and antonym lists. A word without them has open lists,
  // which the relations page offers to fill.
  readonly related?: {
    readonly synonyms: ReadonlyArray<string>;
    readonly antonyms: ReadonlyArray<string>;
  };
  // The letters learners get wrong, which occur in `target`, and a German
  // note on why the word is written that way.
  readonly pitfall?: { readonly tricky: string; readonly note: string };
};

export type SampleUnit = {
  readonly name: string;
  readonly words: ReadonlyArray<SampleWord>;
};

export type SampleBook = {
  readonly name: string;
  readonly units: ReadonlyArray<SampleUnit>;
  // Words that live directly in the book, as a novel's do.
  readonly words: ReadonlyArray<SampleWord>;
};

export type SampleTerm = {
  readonly term: string;
  readonly definition: string;
  readonly keyPoints: ReadonlyArray<string>;
  readonly progress: Progress;
};

export type SampleText = {
  readonly title: string;
  readonly text: string;
  readonly progress: Progress;
};

export type SampleCourse =
  | {
      readonly kind: 'language';
      readonly name: string;
      readonly targetLanguage: Exclude<LanguageCode, 'de'>;
      readonly practisesRelatedWords: boolean;
      readonly books: ReadonlyArray<SampleBook>;
    }
  | {
      readonly kind: 'terms';
      readonly name: string;
      readonly terms: ReadonlyArray<SampleTerm>;
    }
  | {
      readonly kind: 'texts';
      readonly name: string;
      readonly texts: ReadonlyArray<SampleText>;
    };

// One paid AI request; a request without usage failed.
export type SampleUsage = {
  readonly daysAgo: number;
  readonly call: AiCall;
  readonly usage: AiCallUsage | undefined;
};

export type SampleStanding =
  | 'administrator'
  | 'active'
  | 'invited'
  | 'suspended';

export type SamplePerson = {
  readonly name: string;
  readonly email: string;
  readonly standing: SampleStanding;
  readonly joinedDaysAgo: number;
  readonly lastActiveHoursAgo: number | null;
  readonly courses: ReadonlyArray<SampleCourse>;
  readonly usage: ReadonlyArray<SampleUsage>;
};

export const word = (
  target: string,
  native: string,
  progress: Progress,
  details: Omit<SampleWord, 'target' | 'native' | 'progress'> = {},
): SampleWord => ({ target, native, progress, ...details });
