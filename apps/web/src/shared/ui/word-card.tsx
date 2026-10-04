import type { ReactNode } from 'react';

export type CardTone = 'neutral' | 'positive' | 'destructive' | 'warning';

const toneBorder: Record<CardTone, string> = {
  neutral: 'border-border',
  positive: 'border-primary',
  destructive: 'border-destructive',
  warning: 'border-warning-foreground',
};

const wordSize = {
  word: 'text-4xl sm:text-5xl',
  // A sentence to translate runs to several words, so it is set smaller.
  sentence: 'text-2xl sm:text-3xl',
} as const;

type WordCardProps = {
  // What to do with the word: "Übersetze auf Englisch".
  readonly eyebrow: string;
  readonly word: string;
  readonly size?: keyof typeof wordSize;
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
      className={`relative flex animate-rise flex-col gap-5 border bg-card px-6 py-8 transition-colors sm:px-10 sm:py-12 ${toneBorder[tone]}`}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2
        className={`wrap-break-word hyphens-auto text-balance font-display leading-tight ${wordSize[size]}`}
        id={wordId}
        lang={wordLang}
      >
        {word}
      </h2>
      {children}
    </div>
  </div>
);
