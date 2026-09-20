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
  expectedAnswers: ['waiter'],
  explanation: null,
  acceptedAsAlternative: false,
  schedule: {
    advanced: true,
    state: 'review',
    dueAt: new Date('2026-08-30T12:00:00Z'),
  },
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
  expectedAnswers: ['waiter'],
  explanation: null,
  acceptedAsAlternative: false,
  assessmentId: 'assessment',
};

describe('answer feedback', () => {
  it('does not repeat an expected answer that matches the submission', () => {
    expect(render('  Waiter. ')).not.toContain('Erwartet:');
    expect(
      render('hello world', { expectedAnswers: ['hello, world'] }),
    ).not.toContain('Erwartet:');
  });

  it('shows the textbook answer for a different accepted answer', () => {
    expect(render('server')).toContain('Erwartet:');
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
    expect(render('waitor', pendingWrongResult)).toContain('nicht als Lösung');
    expect(render('server')).not.toContain('nicht als Lösung');
  });
});
