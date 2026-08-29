import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SubmitResult } from '../services/practice-service';
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
};

const renderFeedback = (submittedAnswer: string) =>
  renderToStaticMarkup(
    <FeedbackPanel
      audioUrl={null}
      onNext={() => undefined}
      onResolveWrong={() => undefined}
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
