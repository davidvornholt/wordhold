type SessionProgressProps = {
  readonly settled: number;
  readonly total: number;
};

// Distinct cards processed out of the cards the session started with. A card
// that comes back after a wrong answer is still the same card, so the bar
// never moves backwards and the end stays where it was.
export const SessionProgress = ({ settled, total }: SessionProgressProps) => {
  const cardLabel = total === 1 ? 'Karte' : 'Karten';
  return (
    <div className="flex flex-col gap-1.5">
      <progress
        aria-label="Fortschritt"
        className="h-1.5 w-full accent-primary"
        max={total}
        value={settled}
      />
      <p className="text-muted-foreground text-sm">
        {settled} von {total} {cardLabel} bearbeitet
      </p>
    </div>
  );
};
