import { describe, expect, it } from 'bun:test';
import {
  type TermDraft,
  termRepeats,
  termReview,
  termRows,
  termRowWasAdded,
  withAddedTermRow,
  withoutTermRow,
  withRestoredTermRow,
  withTermEdit,
} from './term-draft-rows';

const draft = (term: string, definition = `${term} erklärt`): TermDraft => ({
  term,
  definition,
});

describe('term rows', () => {
  it('keeps a removed row ready to return to its place', () => {
    const rows = termRows([draft('Alkan'), draft('Methan'), draft('Ethan')]);

    const { rows: remaining, removal } = withoutTermRow(rows, 1);

    expect(remaining.map((row) => row.term)).toEqual(['Alkan', 'Ethan']);
    expect(
      removal === null ? [] : withRestoredTermRow(remaining, removal),
    ).toEqual(rows);
  });

  it('keeps the reading confidence of an edited row', () => {
    const rows = termRows([{ ...draft('Trindecan'), confidence: 0.6 }]);

    expect(withTermEdit(rows, 0, { term: 'Tridecan' })[0]).toEqual({
      term: 'Tridecan',
      definition: 'Trindecan erklärt',
      confidence: 0.6,
      rowId: 'read-0',
    });
  });

  it('tells added rows from rows read from the photo', () => {
    const rows = withAddedTermRow(termRows([draft('Alkan')]));

    expect(rows.map(termRowWasAdded)).toEqual([false, true]);
  });
});

describe('termRepeats', () => {
  it('names a term the subject already has before one higher on the page', () => {
    const rows = termRows([draft('Methan'), draft('Methan')]);

    expect(termRepeats(rows, ['Methan'])).toEqual([
      { verdict: 'exact', term: 'Methan', onPage: false },
      { verdict: 'exact', term: 'Methan', onPage: false },
    ]);
  });

  it('finds a term written twice on the page', () => {
    const rows = termRows([draft('Ethan'), draft(' Ethan:')]);

    expect(termRepeats(rows, [])).toEqual([
      { verdict: 'none' },
      { verdict: 'exact', term: 'Ethan', onPage: true },
    ]);
  });

  it('notes a casing variant without treating it as a repeat', () => {
    const rows = termRows([draft('NO')]);

    expect(termRepeats(rows, ['No'])).toEqual([
      { verdict: 'exception', term: 'No', onPage: false },
    ]);
  });
});

describe('termReview', () => {
  it('saves the trimmed terms and skips exact repeats', () => {
    const rows = termRows([
      draft(' Alkan ', ' CnH2n+2 '),
      draft('Methan'),
      draft('Ethan'),
    ]);

    expect(termReview(rows, ['Methan'])).toMatchObject({
      terms: [
        { term: 'Alkan', definition: 'CnH2n+2' },
        { term: 'Ethan', definition: 'Ethan erklärt' },
      ],
      skipped: 1,
      incomplete: [],
    });
  });

  it('ignores empty rows and holds back half-filled ones', () => {
    const rows = termRows([
      draft('', ''),
      draft('Propan', ' '),
      draft('', 'C₄H₁₀'),
      draft('Methan', ''),
    ]);

    expect(termReview(rows, ['Methan'])).toMatchObject({
      terms: [],
      skipped: 1,
      incomplete: [1, 2],
    });
  });
});
