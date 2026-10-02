import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SubmitResult } from '../schemas/practice-models';
import { FeedbackPanel } from './feedback-panel';

const result: SubmitResult = {
  graded: true,
  correct: true,
  stored: true,
  revision: 1,
  rating: 3,
  expectedAnswer: 'waiter',
  explanation: null,
  acceptedAsAlternative: false,
  keyPoints: null,
  schedule: {
    advanced: true,
    state: 'review',
    dueAt: new Date('2026-08-30T12:00:00Z'),
  },
  entryKnown: false,
};

const feedbackId = 'feedback';

const render = (
  submittedAnswer: string,
  overrides: Partial<SubmitResult> = {},
  skipped = false,
) =>
  renderToStaticMarkup(
    <FeedbackPanel
      answerLanguage="en"
      busy={false}
      example={null}
      id={feedbackId}
      kind="language"
      playSentence={null}
      playWord={null}
      repeated={false}
      result={{ ...result, ...overrides } as SubmitResult}
      skipped={skipped}
      submittedAnswer={submittedAnswer}
      targetLanguage="en"
    />,
  );

const heldResult: Partial<SubmitResult> = {
  schedule: { ...result.schedule, advanced: false },
};

const skippedResult: Partial<SubmitResult> = {
  correct: false,
  rating: 1,
  schedule: {
    advanced: true,
    state: 'relearning',
    dueAt: new Date('2026-08-30T12:10:00Z'),
  },
};

const pendingWrongResult: SubmitResult = {
  graded: true,
  correct: false,
  stored: false,
  expectedAnswer: 'waiter',
  explanation: null,
  acceptedAsAlternative: false,
  keyPoints: null,
  assessmentId: 'assessment',
};

describe('answer feedback', () => {
  it('does not repeat an expected answer that matches the submission', () => {
    expect(render('  Waiter. ')).not.toContain('Im Buch:');
    expect(
      render('hello world', { expectedAnswer: 'hello, world' }),
    ).not.toContain('Im Buch:');
  });

  it('shows the book answer beside a different accepted answer', () => {
    const markup = render('server');
    expect(markup).toContain('Im Buch:');
    expect(markup).not.toContain('Erwartet:');
  });

  it('shows the expected answer beside a wrong answer', () => {
    const markup = render('waitor', pendingWrongResult);
    expect(markup).toContain('Erwartet:');
    expect(markup).not.toContain('Im Buch:');
  });

  it('distinguishes an early free exercise from a regular review', () => {
    expect(render('waiter', heldResult)).toContain('Zusätzliche Übung.');
    expect(render('waiter', heldResult)).toContain('Lernplan unverändert.');
  });

  it('reveals the solution of a skipped card without judging an attempt', () => {
    const markup = render('', skippedResult, true);
    expect(markup).toContain('Nicht gewusst');
    expect(markup).toContain('Erwartet:');
    expect(markup).not.toContain('Als richtig werten');
  });

  it('explains the regrading option only while a wrong answer is pending', () => {
    expect(render('waitor', pendingWrongResult)).toContain(
      'nicht als weitere Lösung',
    );
    expect(render('server')).not.toContain('nicht als weitere Lösung');
  });
});
