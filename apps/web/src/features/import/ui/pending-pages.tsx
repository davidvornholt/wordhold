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

type PendingPageItemProps = {
  readonly page: PendingPage;
  readonly label: string;
  readonly confirming: boolean;
  readonly discarding: boolean;
  readonly anyDiscarding: boolean;
  readonly renderPageAction: PendingPagesProps['renderPageAction'];
  readonly onOpenConfirmation: () => void;
  readonly onConfirmDiscard: () => Promise<void>;
  readonly onCancelConfirmation: () => void;
  readonly confirmationActionRef: React.RefObject<HTMLButtonElement | null>;
  readonly registerDiscardAction: (element: HTMLButtonElement | null) => void;
};

const PendingPageItem = ({
  page,
  label,
  confirming,
  discarding,
  anyDiscarding,
  renderPageAction,
  onOpenConfirmation,
  onConfirmDiscard,
  onCancelConfirmation,
  confirmationActionRef,
  registerDiscardAction,
}: PendingPageItemProps) => (
  <li className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-3">
      {renderPageAction(page, label)}
      {confirming ? null : (
        <button
          aria-label={`Aufnahme ${label} löschen`}
          className="border border-input px-2 py-1 text-sm"
          disabled={anyDiscarding}
          onClick={onOpenConfirmation}
          ref={registerDiscardAction}
          type="button"
        >
          Löschen
        </button>
      )}
    </div>
    {confirming ? (
      <fieldset className="flex flex-col gap-2 border-border border-l-4 pl-3 text-sm">
        <legend>Das Foto und dieser offene Import werden gelöscht.</legend>
        <div className="flex flex-wrap gap-2">
          <button
            className="border border-input px-2 py-1"
            disabled={discarding}
            onClick={onConfirmDiscard}
            ref={confirmationActionRef}
            type="button"
          >
            {discarding ? 'Wird gelöscht …' : 'Endgültig löschen'}
          </button>
          <button
            className="px-2 py-1 underline"
            disabled={discarding}
            onClick={onCancelConfirmation}
            type="button"
          >
            Behalten
          </button>
        </div>
      </fieldset>
    ) : null}
  </li>
);

export const PendingPages = ({
  pages,
  renderPageAction,
  onDiscard,
}: PendingPagesProps) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    readonly targetId: string | null;
  } | null>(null);
  const confirmationActionRef = useRef<HTMLButtonElement>(null);
  const discardActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null);
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
      return;
    }
    if (focusRequest !== null) {
      if (focusRequest.targetId === null) {
        sectionHeadingRef.current?.focus();
      } else {
        discardActionRefs.current.get(focusRequest.targetId)?.focus();
      }
    }
  }, [confirmingId, focusRequest]);

  const registerDiscardAction = (
    pageId: string,
    element: HTMLButtonElement | null,
  ): void => {
    if (element === null) {
      discardActionRefs.current.delete(pageId);
      return;
    }
    discardActionRefs.current.set(pageId, element);
    if (
      restoreFocusIdRef.current === pageId ||
      focusRequest?.targetId === pageId
    ) {
      element.focus();
      restoreFocusIdRef.current = null;
    }
  };

  const discardPage = async (page: PendingPage): Promise<void> => {
    setDiscardingId(page.id);
    setError(null);
    const pageIndex = pages.findIndex((candidate) => candidate.id === page.id);
    const focusAfterDiscardId =
      pages[pageIndex + 1]?.id ?? pages[pageIndex - 1]?.id ?? null;
    try {
      await onDiscard(page);
      setFocusRequest({ targetId: focusAfterDiscardId });
      if (focusAfterDiscardId === null) {
        setShowEmptyState(true);
      }
      setConfirmingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDiscardingId(null);
    }
  };

  if (pages.length === 0 && !showEmptyState) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2
        className="font-display text-xl"
        ref={sectionHeadingRef}
        tabIndex={-1}
      >
        Offene Importe
      </h2>
      {pages.length === 0 ? (
        <p className="text-muted-foreground text-sm">Keine offenen Importe.</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Setze einen unterbrochenen Import fort oder lösche die Aufnahme.
          </p>
          <ul className="flex flex-col gap-2">
            {pages.map((page) => {
              const label = `${page.courseName} (${new Date(
                page.capturedAt,
              ).toLocaleDateString('de-DE')})`;
              return (
                <PendingPageItem
                  confirming={confirmingId === page.id}
                  confirmationActionRef={confirmationActionRef}
                  discarding={discardingId === page.id}
                  anyDiscarding={discardingId !== null}
                  key={page.id}
                  label={label}
                  onCancelConfirmation={() => {
                    restoreFocusIdRef.current = page.id;
                    setFocusRequest(null);
                    setConfirmingId(null);
                  }}
                  onConfirmDiscard={() => discardPage(page)}
                  onOpenConfirmation={() => {
                    setError(null);
                    setFocusRequest(null);
                    setConfirmingId(page.id);
                  }}
                  page={page}
                  registerDiscardAction={(element) =>
                    registerDiscardAction(page.id, element)
                  }
                  renderPageAction={renderPageAction}
                />
              );
            })}
          </ul>
        </>
      )}
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
