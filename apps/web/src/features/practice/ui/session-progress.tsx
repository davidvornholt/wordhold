type SessionProgressProps = {
  readonly processed: number;
  readonly total: number;
  readonly repeatCount: number;
  readonly phase: 'main' | 'after-round' | 'checkpoint';
  readonly section: number;
};

// Distinct cards processed out of the cards the session started with. A card
// that comes back after a wrong answer is still the same card, so the bar
// never moves backwards and the end stays where it was.
export const SessionProgress = ({
  processed,
  total,
  repeatCount,
  phase,
  section,
}: SessionProgressProps) => {
  const cardLabel = total === 1 ? 'Karte' : 'Karten';
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-medium text-sm">
        {phase === 'after-round' ? 'Nachrunde' : `Abschnitt ${section}`}
      </p>
      <progress
        aria-label="Fortschritt"
        className="h-1.5 w-full accent-primary"
        max={total}
        value={processed}
      />
      <p className="text-muted-foreground text-sm">
        {processed} von {total} {cardLabel} bearbeitet
        {repeatCount > 0 ? ` · ${repeatCount} für die Nachrunde` : ''}
      </p>
    </div>
  );
};
