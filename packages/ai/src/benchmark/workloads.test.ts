import { describe, expect, it } from 'bun:test';
import { densePage, simplePage } from './extraction-workloads';
import { workloads } from './workloads';

const workload = async (name: string) => {
  const found = (await workloads()).find((item) => item.name === name);
  if (found === undefined) {
    throw new Error(`No workload ${name}`);
  }
  return found;
};

type PrintedEntry = (typeof simplePage.entries)[number];

const printedGrammar = (entry: PrintedEntry) => {
  if (entry.gender !== undefined) {
    return { _tag: 'noun', gender: entry.gender.value, plural: null };
  }
  return entry.grammar === undefined
    ? null
    : { _tag: 'verb', irregularForms: entry.grammar };
};

// The answer a correct extraction gives, with absent optional fields as null
// as the canonical JSON schema shown to providers allows.
const pageAnswer = (
  page: typeof simplePage,
  entries: ReadonlyArray<Record<string, unknown>> = page.entries.map(
    (entry) => ({
      targetText: entry.target,
      nativeText: entry.native,
      grammar: printedGrammar(entry),
      example: entry.example ?? null,
      exampleTranslation: entry.example === undefined ? null : 'Übersetzung',
      confidence: 0.9,
    }),
  ),
) => ({
  unitName: null,
  pageNumber: page.pageNumber,
  pageNumberConfidence: null,
  entries,
  overallConfidence: 0.9,
});

describe('extraction scoring', () => {
  it('passes a correct page answered with null optional fields', async () => {
    expect(
      (await workload('extraction')).qualityFailures(pageAnswer(simplePage)),
    ).toEqual([]);
    expect(
      (await workload('extraction-photo')).qualityFailures(
        pageAnswer(densePage),
      ),
    ).toEqual([]);
  });

  it('fails only the entry that was missed, and extracted distractors', async () => {
    const answer = pageAnswer(densePage);
    const [first, , ...rest] = answer.entries;
    const failures = (await workload('extraction-photo')).qualityFailures({
      ...answer,
      entries: [
        first,
        ...rest,
        { targetText: 'Eilean Donan Castle', nativeText: '', confidence: 0.2 },
      ],
    });
    expect(failures).toEqual(['Entry 2 missing', 'Distractor extracted']);
  });

  it('accepts printed grammar kept with the headword', async () => {
    const answer = pageAnswer(densePage);
    const failures = (await workload('extraction-photo')).qualityFailures({
      ...answer,
      entries: answer.entries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              targetText: 'to bring, brought, brought',
              grammar: null,
            }
          : entry,
      ),
    });
    expect(failures).toEqual([]);
  });

  it('accepts a gender marker kept with the headword but not a dropped one', async () => {
    const answer = pageAnswer(simplePage);
    const withProgram = (targetText: string) =>
      answer.entries.map((entry, index) =>
        index === 3 ? { ...entry, targetText, grammar: null } : entry,
      );
    const extraction = await workload('extraction');
    expect(
      extraction.qualityFailures({
        ...answer,
        entries: withProgram('el programa m.'),
      }),
    ).toEqual([]);
    expect(
      extraction.qualityFailures({
        ...answer,
        entries: withProgram('el programa'),
      }),
    ).toEqual(['Entry 4 gender missing']);
  });
});

describe('generation scoring', () => {
  it('rejects double quotes that production prompts forbid', async () => {
    expect(
      (await workload('translation-spanish')).qualityFailures({
        native: 'Morgen muss ich für die "Matheprüfung" lernen.',
      }),
    ).toEqual(['Double quotes used']);
  });

  it('rejects a word-for-word idiom translation', async () => {
    expect(
      (await workload('translation-idiom')).qualityFailures({
        native: 'Es regnet Katzen und Hunde, also bleiben wir heute drinnen.',
      }),
    ).toEqual(['Literal translation']);
  });
});
