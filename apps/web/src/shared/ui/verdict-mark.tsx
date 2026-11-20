const paths = {
  check: 'M4.5 12.5l5 5L19.5 7',
  cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
} as const;

const tones = {
  check: 'text-primary',
  cross: 'text-destructive',
} as const;

// A check or cross drawn like a pen stroke, so every verdict on a card is
// marked in the same hand. A delay class staggers marks drawn in a row.
export const VerdictMark = ({
  className,
  delayClass = '',
  kind,
}: {
  readonly className: string;
  readonly delayClass?: string;
  readonly kind: keyof typeof paths;
}) => (
  <svg
    aria-hidden="true"
    className={`shrink-0 ${tones[kind]} ${className}`}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      className={`animate-draw [stroke-dasharray:1] ${delayClass}`}
      d={paths[kind]}
      pathLength="1"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
    />
  </svg>
);
