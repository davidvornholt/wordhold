import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

type PendingPage = {
  readonly id: string;
  readonly courseName: string;
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
  const confirmationActionRef = useRef<HTMLButtonElement>(null);
  const discardActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (confirmingId !== null) {
      confirmationActionRef.current?.focus();
      return;
    }
    const restoreFocusId = restoreFocusIdRef.current;
    if (restoreFocusId !== null) {
      discardActionRefs.current.get(restoreFocusId)?.focus();
      restoreFocusIdRef.current = null;
    }
  }, [confirmingId]);

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
          const label = `${page.courseName} (${new Date(
            page.capturedAt,
          ).toLocaleDateString('de-DE')})`;
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
                    ref={(element) => {
                      if (element === null) {
                        discardActionRefs.current.delete(page.id);
                        return;
                      }
                      discardActionRefs.current.set(page.id, element);
                    }}
                    type="button"
                  >
                    Löschen
                  </button>
                )}
              </div>
              {confirming ? (
                <fieldset className="flex flex-col gap-2 border-border border-l-4 pl-3 text-sm">
                  <legend>
                    Das Foto und dieser offene Import werden gelöscht.
                  </legend>
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
                      ref={confirmationActionRef}
                      type="button"
                    >
                      {discarding ? 'Wird gelöscht …' : 'Endgültig löschen'}
                    </button>
                    <button
                      className="px-2 py-1 underline"
                      disabled={discarding}
                      onClick={() => {
                        restoreFocusIdRef.current = page.id;
                        setConfirmingId(null);
                      }}
                      type="button"
                    >
                      Behalten
                    </button>
                  </div>
                </fieldset>
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
