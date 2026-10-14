import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { EyeOffIcon } from 'lucide-react';

const PitfallEntry = ({
  pitfall,
  language,
}: {
  readonly pitfall: SpellingPitfall;
  readonly language: LanguageCode;
}) => {
  const entry = pitfall.segments.map((segment) => segment.text).join('');
  const tricky = pitfall.segments
    .filter((segment) => segment.tricky)
    .map((segment) => segment.text);
  return (
    <div className="grid gap-1">
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
          <span lang={language}>{entry}</span>, achte auf{' '}
          <span lang={language}>{tricky.join(' und ')}</span>
        </span>
      </p>
      <p className="text-sm">{pitfall.note}</p>
    </div>
  );
};

// Where a word is most often misspelled: the whole entry with its tricky
// letters marked, and a note on why they are written that way. A mark cannot
// be heard, so screen readers get the entry whole and the letters named.
//
// While the learner writes the word from memory, the note is covered in place
// rather than removed: its contents fade out and a line saying why fades in
// after them, so nothing below moves, the two never show over each other, and
// the empty space does not look like a fault. A note prepared after the card
// opened fades in rather than appearing at once.
export const SpellingPitfallNote = ({
  pitfalls,
  language,
  covered = false,
}: {
  readonly pitfalls: ReadonlyArray<SpellingPitfall> | null;
  readonly language: LanguageCode;
  readonly covered?: boolean;
}) =>
  pitfalls === null || pitfalls.length === 0 ? null : (
    <div
      className={`grid gap-2 border-l pl-3 starting:opacity-0 transition-[opacity,border-color] ${covered ? 'border-border' : 'border-warning-foreground'}`}
    >
      <p className="eyebrow">
        {pitfalls.length === 1 ? 'Stolperstelle' : 'Stolperstellen'}
      </p>
      <div className="grid">
        <div
          className={`col-start-1 row-start-1 grid gap-3 transition-[opacity,filter,visibility] ${covered ? 'invisible opacity-0 blur-sm duration-(--motion-fast)' : 'delay-(--motion-fast)'}`}
        >
          {pitfalls.map((pitfall) => (
            <PitfallEntry
              key={`${pitfall.segments.map((segment) => segment.text).join('')} ${pitfall.note}`}
              language={language}
              pitfall={pitfall}
            />
          ))}
        </div>
        <p
          className={`col-start-1 row-start-1 flex items-center gap-2 self-center text-muted-foreground text-sm transition-[opacity,visibility] ${covered ? 'delay-(--motion-fast)' : 'invisible opacity-0 duration-(--motion-fast)'}`}
        >
          <EyeOffIcon aria-hidden={true} className="size-4 shrink-0" />
          Ausgeblendet, solange du schreibst.
        </p>
      </div>
    </div>
  );
