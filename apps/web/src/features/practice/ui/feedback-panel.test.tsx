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

const renderFeedback = (submittedAnswer: string) =>
  renderToStaticMarkup(
    <FeedbackPanel
      audioUrl={null}
      onNext={() => undefined}
      onResolveWrong={() => undefined}
      repeated={false}
      resolution={null}
      result={result}
      submittedAnswer={submittedAnswer}
    />,
  );

describe('answer feedback', () => {
  it('does not repeat an expected answer that matches the submission', () => {
    expect(renderFeedback('  Waiter. ')).not.toContain('Erwartet:');
  });

  it('shows the textbook answer for a different accepted answer', () => {
    expect(renderFeedback('server')).toContain('Erwartet:');
  });
});
