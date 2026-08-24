type ExtractionRecoveryProps = {
  readonly busy: boolean;
  readonly onRetry: () => void;
};

export const ExtractionRecovery = ({
  busy,
  onRetry,
}: ExtractionRecoveryProps) => (
  <div aria-busy={busy} className="flex flex-col items-start gap-3">
    <p className="text-neutral-600 text-sm">
      Die Seite wurde noch nicht ausgelesen oder das Auslesen ist
      fehlgeschlagen.
    </p>
    <button
      className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      disabled={busy}
      onClick={onRetry}
      type="button"
    >
      {busy ? 'Wird gelesen …' : 'Erneut auslesen'}
    </button>
  </div>
);
