import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { staleEntryEditMessage } from '../errors/courses-errors';
import { EditEntryFooter } from './edit-entry-footer';

const footer = (error: string | null) =>
  renderToStaticMarkup(
    <EditEntryFooter
      busy={false}
      error={error}
      onCancel={() => undefined}
      submittable={true}
    />,
  );

describe('EditEntryFooter', () => {
  it('offers to reload the page when the entry was saved elsewhere meanwhile', () => {
    const markup = footer(staleEntryEditMessage);
    expect(markup).toContain(staleEntryEditMessage);
    expect(markup).toContain('Seite neu laden');
  });

  it('offers no reload for another failure or none', () => {
    expect(footer('Das Wort gibt es schon.')).not.toContain('Seite neu laden');
    expect(footer(null)).not.toContain('Seite neu laden');
  });
});
