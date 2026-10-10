import type { ModelMessage } from 'ai';
import type { Schema } from 'effect';
import type { AiOperation } from '../usage';

// One production prompt with a known good answer. `schema` is the Effect
// schema production decodes with; each candidate converts it to the JSON
// Schema its provider is shown.
export type Workload = {
  readonly name: string;
  readonly operation: AiOperation;
  readonly prompt: string;
  readonly messages: Array<ModelMessage>;
  readonly schema: Schema.Top;
  readonly qualityFailures: (output: unknown) => ReadonlyArray<string>;
};

// Production sends text prompts as a single user message.
export const textWorkload = (
  workload: Omit<Workload, 'messages'>,
): Workload => ({
  ...workload,
  messages: [{ role: 'user', content: workload.prompt }],
});

// Production prompts forbid double and typographic quotes in stored text.
const doubleQuotes = /["“”„«»]/u;

export const quoteFailures = (
  texts: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  texts.some((text) => doubleQuotes.test(text)) ? ['Double quotes used'] : [];

// Compares printed text without penalizing typographic apostrophes, dashes
// or line breaks that the page layout introduced.
export const normalizeText = (text: string): string =>
  text
    .replaceAll(/[‘’ʼ]/gu, "'")
    .replaceAll(/[–—]/gu, '-')
    .replaceAll(/\s+/gu, ' ')
    .trim();
