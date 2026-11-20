import type { ReactNode } from 'react';
import { practiceCardClass } from './surface-styles';

// A sentence to translate runs to several words, so it is set smaller.
const sentenceSize = 'text-2xl sm:text-3xl';

// A word shrinks from 36px until its longest word fits on one line of the
// card, so compounds like "Generationenkonflikt" do not break mid-word. Real
// words average at most about 0.58em per Spectral letter. A word too long to
// fit at 24px hyphenates instead.
const lineBreakOpportunities = /[\s-]+/u;

const wordFontSize = (word: string) => {
  const letters = Math.max(
    ...word.split(lineBreakOpportunities).map((part) => [...part].length),
  );
  return `clamp(1.5rem, 100cqi / ${letters} / 0.58, 2.25rem)`;
};

type WordCardProps = {
  // What to do with the word: "Übersetze auf Englisch".
  readonly instruction: ReactNode;
  readonly word: string;
  readonly size?: 'word' | 'sentence';
  readonly wordId: string;
  readonly wordLang: string | undefined;
  // A short note on how to answer, under the word.
  readonly hint?: ReactNode;
  // The line the answer is written on, and once answered, the back of the
  // card.
  readonly children?: ReactNode;
  // The buttons that check or continue the card, at its foot.
  readonly actions: ReactNode;
  // Cards still waiting behind this one in the round; at most two show.
  readonly deck: number;
};

// The edges of the waiting cards, the farthest first so the nearer one is drawn
// over it. Each peeks out further below the card and narrower, like a stack of
// index cards seen from above.
const deckEdges = ['inset-x-6 -bottom-3', 'inset-x-3 -bottom-1.5'];

// The index card on top of the round's stack. The word is the hero; everything
// else on it is small. Its buttons sit on it, so the card and what it asks for
// move as one: dealCard moves the answered one out to the left while the next
// one rises from the stack. The card keeps its own view-transition group for
// that, and the stack stays outside it, so the stack holds still and thins out
// as the round goes on.
export const WordCard = ({
  instruction,
  word,
  size = 'word',
  wordId,
  wordLang,
  hint,
  children,
  actions,
  deck,
}: WordCardProps) => (
  <div className="relative">
    {deckEdges.slice(Math.max(deckEdges.length - deck, 0)).map((edge) => (
      <div
        aria-hidden="true"
        className={`absolute top-0 border border-border bg-card ${edge}`}
        key={edge}
      />
    ))}
    <div className="practice-card relative">
      <div
        className={`@container flex origin-bottom animate-deal-in flex-col gap-6 px-6 pt-7 pb-6 sm:px-10 sm:pt-9 sm:pb-8 ${practiceCardClass}`}
      >
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{instruction}</p>
          <h2
            className={`wrap-break-word hyphens-auto text-balance font-display leading-tight ${size === 'sentence' ? sentenceSize : ''}`}
            id={wordId}
            lang={wordLang}
            // biome-ignore lint/nursery/noInlineStyles: The size follows the length of the word, which is data.
            style={
              size === 'word' ? { fontSize: wordFontSize(word) } : undefined
            }
          >
            {word}
          </h2>
          {hint}
        </div>
        {children}
        {actions}
      </div>
    </div>
  </div>
);
