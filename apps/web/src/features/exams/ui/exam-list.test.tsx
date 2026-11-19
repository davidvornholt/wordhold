import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExamSummary } from '../schemas/exam-models';
import { ExamSection } from './exam-list';

const exams = (count: number): ReadonlyArray<ExamSummary> =>
  Array.from({ length: count }, (_, index) => ({
    id: `exam-${index + 1}`,
    courseId: 'course',
    name: `Test ${index + 1}`,
    directions: ['to_target'],
    createdAt: new Date('2026-09-01T12:00:00Z'),
    entryCount: 10,
    lastRound: null,
  }));

const render = (list: ReadonlyArray<ExamSummary>) =>
  renderToStaticMarkup(
    <ExamSection
      exams={list}
      newExamAction={null}
      renderExamLink={(exam) => <a href={`/${exam.id}`}>{exam.name}</a>}
      subject={{ kind: 'language', targetLanguage: 'en' }}
    />,
  );

// The names in the order they appear before and inside the fold.
const split = (markup: string) => {
  const [shown = '', folded = ''] = markup.split('<details>');
  const names = (part: string) =>
    [...part.matchAll(/>(?<name>Test \d+)</gu)].map(
      (match) => match.groups?.name,
    );
  return { shown: names(shown), folded: names(folded) };
};

describe('ExamSection', () => {
  it('shows the three tests practised most recently and folds the rest away', () => {
    const markup = render(exams(5));
    expect(split(markup)).toEqual({
      shown: ['Test 1', 'Test 2', 'Test 3'],
      folded: ['Test 4', 'Test 5'],
    });
    expect(markup).toContain('<summary');
    expect(markup).toContain('>2 weitere Tests</summary>');
  });

  it('names a single folded test in the singular', () => {
    expect(render(exams(4))).toContain('>1 weiterer Test</summary>');
  });

  it('folds nothing away while there are three tests or fewer', () => {
    const markup = render(exams(3));
    expect(markup).not.toContain('<details>');
    expect(split(markup).shown).toEqual(['Test 1', 'Test 2', 'Test 3']);
  });

  it('explains what a test is for while the course has none', () => {
    const markup = render([]);
    expect(markup).not.toContain('<ul');
    expect(markup).toContain('Lege einen Test an');
  });
});
