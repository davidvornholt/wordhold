import type { ReactNode } from 'react';

export type CardTone = 'neutral' | 'positive' | 'destructive' | 'warning';

const toneBorder: Record<CardTone, string> = {
  neutral: 'border-border',
  positive: 'border-primary',
  destructive: 'border-destructive',
  warning: 'border-warning-foreground',
};

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
  readonly eyebrow: ReactNode;
  readonly word: string;
  readonly size?: 'word' | 'sentence';
  readonly wordId: string;
  readonly wordLang: string | undefined;
  readonly tone: CardTone;
  // Cards still waiting behind this one in the round; at most two show.
  readonly deck: number;
  // Revealed once answered: the back of the card.
  readonly children?: ReactNode;
};

const deckOffsets = [
  'translate-x-1.5 translate-y-1.5',
  'translate-x-3 translate-y-3',
];

// The index card. The word is the hero; everything else on it is small. It
// sits on the remaining stack, and its edge takes the answer's tone.
export const WordCard = ({
  eyebrow,
  word,
  size = 'word',
  wordId,
  wordLang,
  tone,
  deck,
  children,
}: WordCardProps) => (
  <div className="relative">
    {deckOffsets.slice(0, Math.min(deck, deckOffsets.length)).map((offset) => (
      <div
        aria-hidden="true"
        className={`absolute inset-0 border border-border bg-card ${offset}`}
        key={offset}
      />
    ))}
    <div
      className={`@container relative flex animate-rise flex-col gap-5 border bg-card px-6 py-8 transition-colors sm:px-10 sm:py-12 ${toneBorder[tone]}`}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2
        className={`wrap-break-word hyphens-auto text-balance font-display leading-tight ${size === 'sentence' ? sentenceSize : ''}`}
        id={wordId}
        lang={wordLang}
        // biome-ignore lint/nursery/noInlineStyles: The size follows the length of the word, which is data.
        style={size === 'word' ? { fontSize: wordFontSize(word) } : undefined}
      >
        {word}
      </h2>
      {children}
    </div>
  </div>
);
