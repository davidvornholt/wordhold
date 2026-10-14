import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';

// Where a word is most often misspelled: the word with its tricky letters
// marked, and a note on why they are written that way. A mark cannot be
// heard, so screen readers get the word whole and the letters named.
export const SpellingPitfallNote = ({
  pitfalls,
  language,
  hidden = false,
}: {
  readonly pitfalls: ReadonlyArray<SpellingPitfall> | null;
  readonly language: LanguageCode;
  // Keeps the note's place on the card while it must not be read.
  readonly hidden?: boolean;
}) =>
  pitfalls === null || pitfalls.length === 0 ? null : (
    <div
      className={`grid gap-2 border-warning-foreground border-l pl-3 ${hidden ? 'invisible' : ''}`}
    >
      <p className="eyebrow">
        {pitfalls.length === 1 ? 'Stolperstelle' : 'Stolperstellen'}
      </p>
      {pitfalls.map((pitfall) => {
        const word = pitfall.segments.map((segment) => segment.text).join('');
        const tricky = pitfall.segments
          .filter((segment) => segment.tricky)
          .map((segment) => segment.text);
        return (
          <div className="grid gap-1" key={`${word} ${pitfall.note}`}>
            <p className="font-medium text-lg">
              <span aria-hidden="true" lang={language}>
                {pitfall.segments.map((segment, index) =>
                  segment.tricky ? (
                    <mark
                      className="rounded-xs bg-warning text-warning-foreground underline decoration-2 underline-offset-4"
                      // biome-ignore lint/suspicious/noArrayIndexKey: The segments of a stored pitfall never change or reorder.
                      key={index}
                    >
                      {segment.text}
                    </mark>
                  ) : (
                    segment.text
                  ),
                )}
              </span>
              <span className="sr-only">
                <span lang={language}>{word}</span>, achte auf{' '}
                <span lang={language}>{tricky.join(' und ')}</span>
              </span>
            </p>
            <p className="text-sm">{pitfall.note}</p>
          </div>
        );
      })}
    </div>
  );
