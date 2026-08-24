type AudioRecoveryProps = {
  readonly imported: number | null;
  readonly pending: number | null;
  readonly busy: boolean;
  readonly onRetry: () => void;
};

export const AudioRecovery = ({
  imported,
  pending,
  busy,
  onRetry,
}: AudioRecoveryProps) => (
  <section aria-busy={busy} aria-live="polite" className="audio-recovery">
    <h2 className="audio-recovery-heading">Import abgeschlossen</h2>
    <p className="audio-recovery-copy">
      {imported === null
        ? 'Die Einträge wurden bereits importiert.'
        : `${imported} Einträge wurden importiert.`}{' '}
      {pending === null
        ? 'Fehlende Audiodateien können erneut erstellt werden.'
        : `${pending} Audiodateien fehlen noch.`}
    </p>
    <button
      className="audio-recovery-button"
      disabled={busy}
      onClick={onRetry}
      type="button"
    >
      {busy ? 'Audio wird erstellt …' : 'Fehlende Audiodateien erstellen'}
    </button>
  </section>
);
