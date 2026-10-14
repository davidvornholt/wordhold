import { describe, expect, it } from 'bun:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnswerField, type AnswerFieldElement } from './answer-field';

const render = (multiline: boolean) =>
  renderToStaticMarkup(
    <AnswerField
      borderClass=""
      characters={null}
      disabled={false}
      fieldRef={createRef<AnswerFieldElement>()}
      lang="en"
      multiline={multiline}
      onChange={() => undefined}
      placeholder="Antwort"
      value="adolesent"
    />,
  );

describe('AnswerField', () => {
  it('gives no spelling help in either shape', () => {
    for (const multiline of [false, true]) {
      const markup = render(multiline);
      expect(markup).toContain('spellCheck="false"');
      expect(markup).toContain('autoComplete="off"');
      expect(markup).toContain('autoCorrect="off"');
    }
  });
});
