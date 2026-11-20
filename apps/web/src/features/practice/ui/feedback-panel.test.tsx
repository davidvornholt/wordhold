import { describe, expect, it } from 'bun:test';
import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerTimeZoneContext } from '../../../shared/dates/owner-time-zone';
import type { FeedbackResult } from '../schemas/practice-models';
import { FeedbackPanel } from './feedback-panel';
import {
  type OtherWordingAttempt,
  OtherWordingNotice,
} from './other-wording-notice';

const result: FeedbackResult = {
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

// Stands in for the line a missed answer is written out on.
const copyLine = <input aria-label="Schreib die Antwort ab" />;

const render = (
  submittedAnswer: string,
  overrides: Partial<FeedbackResult> = {},
  {
    retype = null,
    skipped = false,
    spellingPitfalls = null,
  }: {
    readonly retype?: ReactNode;
    readonly skipped?: boolean;
    readonly spellingPitfalls?: ReadonlyArray<SpellingPitfall> | null;
  } = {},
) =>
  renderToStaticMarkup(
    <OwnerTimeZoneContext value="Europe/Berlin">
      <FeedbackPanel
        answerLanguage="en"
        busy={false}
        dictated={false}
        example={null}
        id={feedbackId}
        kind="language"
        repeated={false}
        result={{ ...result, ...overrides } as FeedbackResult}
        retype={retype}
        sentence={null}
        skipped={skipped}
        spellingPitfalls={spellingPitfalls}
        submittedAnswer={submittedAnswer}
        targetLanguage="en"
        word={null}
      />
    </OwnerTimeZoneContext>,
  );

const heldResult: Partial<FeedbackResult> = {
  schedule: { ...result.schedule, advanced: false },
};

const skippedResult: Partial<FeedbackResult> = {
  correct: false,
  rating: 1,
  schedule: {
    advanced: true,
    state: 'relearning',
    dueAt: new Date('2026-08-30T12:10:00Z'),
  },
};

const pitfall: SpellingPitfall = {
  segments: [
    { text: 'wait', tricky: false },
    { text: 'er', tricky: true },
  ],
  note: 'Am Ende -er, wie bei teacher.',
};

const pendingWrongResult: FeedbackResult = {
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
    expect(render('  waiter. ')).not.toContain('Im Buch:');
    expect(
      render('hello world', { expectedAnswer: 'hello, world' }),
    ).not.toContain('Im Buch:');
  });

  it('shows the book answer beside a different accepted answer', () => {
    const markup = render('server');
    expect(markup).toContain('Im Buch:');
    expect(markup).not.toContain('Erwartet:');
    expect(render('Waiter')).toContain('Im Buch:');
  });

  it('counts an answer in other words as right and names the book word', () => {
    const markup = render('server', { rating: 2 });
    expect(markup).toContain('>Richtig</span>');
    expect(markup).toContain('Im Buch: ');
    expect(markup).toContain('>waiter</span>');
    expect(markup).not.toContain('Erwartet:');
    expect(markup).not.toContain('als gültige Alternative gespeichert');
  });

  // A missed word is always written out, so the book's word shows once, as
  // the faint letters of that line, and the verdict names it for screen
  // readers.
  it('names the expected answer of a wrong word once, under the attempt', () => {
    const markup = render('waitor', pendingWrongResult, { retype: copyLine });
    expect(markup).toContain('Deine Antwort: <span lang="en">waitor</span>');
    expect(markup).toContain('Erwartet: <span lang="en">waiter</span>');
    expect(markup).toContain(copyLine.props['aria-label']);
    expect(markup).not.toContain('Im Buch:');
  });

  it('distinguishes an early free exercise from a regular review', () => {
    expect(render('waiter', heldResult)).toContain(
      'Zusätzliche Übung, kommt wie geplant',
    );
    expect(render('waiter')).not.toContain('Zusätzliche Übung');
  });

  it('reveals the solution of a skipped card without judging an attempt', () => {
    const markup = render('', skippedResult, {
      retype: copyLine,
      skipped: true,
    });
    expect(markup).toContain('Nicht gewusst');
    expect(markup).toContain('Erwartet: <span lang="en">waiter</span>');
    expect(markup).not.toContain('Deine Antwort:');
    expect(markup).not.toContain('Als richtig werten');
  });

  it('shows where the word is misspelled after a right answer too', () => {
    const markup = render('waiter', {}, { spellingPitfalls: [pitfall] });
    expect(markup).toContain('Stolperstelle');
    expect(markup).toContain('>er</mark>');
    expect(markup).toContain('Am Ende -er, wie bei teacher.');
  });

  it('leaves out the spelling pitfalls of a word without any', () => {
    expect(render('waiter', {}, { spellingPitfalls: [] })).not.toContain(
      'Stolperstelle',
    );
    expect(render('waiter')).not.toContain('Stolperstelle');
  });
});

const renderNotice = (attempt: Omit<OtherWordingAttempt, 'attempt'>) =>
  renderToStaticMarkup(
    <OtherWordingNotice
      answerLanguage="es"
      attempt={{ ...attempt, attempt: 1 }}
    />,
  );

describe('answer in other wording', () => {
  const answer = 'concentrarse en algo';

  it('asks for another word from the book without naming it', () => {
    const markup = renderNotice({ answer, courseEntry: null });
    expect(markup).toContain(
      'Auch richtig, aber hier ist ein anderes Wort aus dem Buch gesucht.',
    );
    expect(markup).toContain(
      'Deine Antwort: <span lang="es">concentrarse en algo</span>',
    );
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('Erwartet');
    expect(markup).not.toContain('Vertippt');
    expect(markup).not.toContain('text-destructive');
    expect(markup).not.toContain('text-primary');
  });

  it('names where the course teaches the answer', () => {
    const markup = renderNotice({
      answer,
      courseEntry: {
        text: 'concentrarse (en algo)',
        place: 'U5 Y después del instituto, ¿qué? / ¡Acércate!',
      },
    });
    expect(markup).toContain(
      'Auch richtig, aber hier ist ein anderes Wort gesucht.',
    );
    expect(markup).toContain(
      '‚<span lang="es">concentrarse (en algo)</span>‘ steht in U5 Y después del instituto, ¿qué? / ¡Acércate!</p>',
    );
  });

  it('ends a unit name that does not end a sentence with a period', () => {
    expect(
      renderNotice({
        answer,
        courseEntry: { text: 'concentrarse (en algo)', place: 'U5 Mi futuro' },
      }),
    ).toContain('steht in U5 Mi futuro.</p>');
  });
});
