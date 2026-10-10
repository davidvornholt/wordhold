import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SentenceResult } from '../schemas/sentence-models';
import { SentenceFeedback } from './sentence-feedback';
import type { SentenceOutcome } from './use-sentence-check';

const reference = 'Mi hermana es abogada.';
const feedbackId = 'feedback';

const render = (outcome: SentenceOutcome, repeated = false) =>
  renderToStaticMarkup(
    <SentenceFeedback
      id={feedbackId}
      outcome={outcome}
      playSentence={null}
      reference={reference}
      repeated={repeated}
      targetLanguage="es"
    />,
  );

const checked = (answer: string, result: SentenceResult): SentenceOutcome => ({
  kind: 'checked',
  answer,
  result,
});

describe('SentenceFeedback', () => {
  it('shows the correction, the reason and the stored translation after a mistake', () => {
    const markup = render(
      checked('Mi hermano es abogada.', {
        graded: true,
        correct: false,
        reference,
        correction: 'Mi hermana es abogada!',
        explanation: "'hermano' heißt 'Bruder'.",
      }),
    );
    expect(markup).toContain('Noch nicht richtig');
    expect(markup).toContain('&#x27;hermano&#x27; heißt &#x27;Bruder&#x27;.');
    expect(markup).toContain('Musterlösung: ');
    // A correction that only repeats the stored translation adds nothing.
    expect(markup).not.toContain('Korrigiert: ');
  });

  it('labels the stored translation as another wording beside a correct paraphrase', () => {
    const markup = render(
      checked('Mi hermana trabaja de abogada.', {
        graded: true,
        correct: true,
        reference,
        correction: null,
        explanation: null,
      }),
    );
    expect(markup).toContain('Richtig');
    expect(markup).toContain('Auch möglich: ');
    expect(markup).toContain(reference);
  });

  it('says a sentence missed earlier is right this time', () => {
    const markup = render(
      checked('Mi hermana es abogada.', {
        graded: true,
        correct: true,
        reference,
        correction: null,
        explanation: null,
      }),
      true,
    );
    expect(markup).toContain('Diesmal richtig');
  });

  it('does not repeat the stored translation when the answer was it', () => {
    const markup = render(
      checked('Mi hermana es abogada', {
        graded: true,
        correct: true,
        reference,
        correction: null,
        explanation: null,
      }),
    );
    expect(markup).not.toContain(reference);
  });

  it('says why an answer was not graded and still shows the translation', () => {
    const markup = render(
      checked('Mi hermana es juez.', {
        graded: false,
        reference,
        message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
      }),
    );
    expect(markup).toContain('Der KI-Prüfer ist gerade nicht erreichbar.');
    expect(markup).toContain('Musterlösung: ');
  });

  it('shows the stored translation for a sentence given up on', () => {
    const markup = render({ kind: 'skipped' });
    expect(markup).toContain('Nicht gewusst');
    expect(markup).toContain(reference);
  });
});
