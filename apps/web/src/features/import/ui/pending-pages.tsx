import type { ReactNode } from 'react';
import { useState } from 'react';

type PendingPage = {
  readonly id: string;
  readonly courseName: string;
  readonly label: string | null;
  readonly capturedAt: Date;
};

type PendingPagesProps = {
  readonly pages: ReadonlyArray<PendingPage>;
  readonly renderPageAction: (page: PendingPage, label: string) => ReactNode;
  readonly onDiscard: (page: PendingPage) => Promise<void>;
};

export const PendingPages = ({
  pages,
  renderPageAction,
  onDiscard,
}: PendingPagesProps) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pages.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Offene Importe</h2>
      <p className="text-muted-foreground text-sm">
        Setze einen unterbrochenen Import fort oder lösche die Aufnahme.
      </p>
      <ul className="flex flex-col gap-2">
        {pages.map((page) => {
          const label = `${page.courseName}${
            page.label === null ? '' : ` – ${page.label}`
          } (${new Date(page.capturedAt).toLocaleDateString('de-DE')})`;
          const confirming = confirmingId === page.id;
          const discarding = discardingId === page.id;
          return (
            <li className="flex flex-col gap-2" key={page.id}>
              <div className="flex flex-wrap items-center gap-3">
                {renderPageAction(page, label)}
                {confirming ? null : (
                  <button
                    aria-label={`Aufnahme ${label} löschen`}
                    className="border border-input px-2 py-1 text-sm"
                    disabled={discardingId !== null}
                    onClick={() => {
                      setError(null);
                      setConfirmingId(page.id);
                    }}
                    type="button"
                  >
                    Löschen
                  </button>
                )}
              </div>
              {confirming ? (
                <div className="flex flex-col gap-2 border-border border-l-4 pl-3 text-sm">
                  <p>Das Foto und dieser offene Import werden gelöscht.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="border border-input px-2 py-1"
                      disabled={discarding}
                      onClick={async () => {
                        setDiscardingId(page.id);
                        setError(null);
                        try {
                          await onDiscard(page);
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : String(cause),
                          );
                        } finally {
                          setDiscardingId(null);
                        }
                      }}
                      type="button"
                    >
                      {discarding ? 'Wird gelöscht …' : 'Endgültig löschen'}
                    </button>
                    <button
                      className="px-2 py-1 underline"
                      disabled={discarding}
                      onClick={() => setConfirmingId(null)}
                      type="button"
                    >
                      Behalten
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
